import unittest
import hashlib
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from tools.build_traces import (Attempt, build_run, campaign_selection,
                                index_store, restore_user_messages)


class Figure1SelectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.store = Path(self.temp.name)
        self.root = self.store / 'recent_evaluations/20260923_fable_sol_campaigns_v1'
        self.root.mkdir(parents=True)
        self.result = self.root / 'models/fable51/results/campaign/task/selected/result.json'
        self.result.parent.mkdir(parents=True)
        self.result.write_text(json.dumps({
            'attempt_id': 'selected', 'scaffold': 'claude_code',
            'samples': [{'epoch': 0, 'infrastructure_status': 'valid', 'solved': False}],
        }))
        self.stdout = self.root / 'models/fable51/traces/campaign/task/selected/stdout.txt'
        self.stdout.parent.mkdir(parents=True)
        self.stdout.write_text('transcript')
        self.row = {
            'attempt_id': 'selected', 'model': 'fable51', 'task': 'task',
            'campaign': 'campaign', 'epoch': 0, 'infrastructure_status': 'valid',
            'result_stored': str(self.result.relative_to(self.root)),
            'result_sha256': hashlib.sha256(self.result.read_bytes()).hexdigest(),
            'stdout_stored': str(self.stdout.relative_to(self.root)),
            'stdout_sha256': hashlib.sha256(self.stdout.read_bytes()).hexdigest(),
            'luna_judgment': {'route_attempt': 'supported'},
        }
        self.manifest = self.store / 'selection.json'
        self.manifest.write_text(json.dumps({
            'attempts': [self.row],
            'expected_models': {'fable51': {'attempts': 1, 'tasks': 1, 'supported_tasks': 1}},
        }))
        self.inventory = self.root / 'attempts.json'
        self.inventory.write_text(json.dumps([
            self.row, {**self.row, 'attempt_id': 'unselected'},
        ]))

    def select(self, existing=None):
        with patch('tools.build_traces.FIGURE1_SELECTION', self.manifest):
            return campaign_selection(self.store, existing or set())

    def test_only_allowlisted_ids_are_exported(self):
        self.assertEqual(set(self.select()), {'selected'})

    def test_selected_result_tampering_stops_export(self):
        self.result.write_text(self.result.read_text() + '\n')
        with self.assertRaisesRegex(ValueError, 'digest mismatch'):
            self.select()

    def test_invalid_inventory_entry_stops_export(self):
        self.inventory.write_text(json.dumps([{**self.row, 'infrastructure_status': 'invalid'}]))
        with self.assertRaisesRegex(ValueError, 'inventory mismatch'):
            self.select()

    def test_selected_stdout_tampering_stops_export(self):
        self.stdout.write_text('changed transcript')
        with self.assertRaisesRegex(ValueError, 'stdout digest mismatch'):
            self.select()

    def test_collision_with_original_selection_stops_export(self):
        with self.assertRaisesRegex(ValueError, 'duplicate campaign attempt'):
            self.select({'selected'})

    def test_split_result_and_trace_directories_are_joined(self):
        trace = self.root / 'models/fable51/traces/campaign/task/selected/stdout.txt'
        trace.parent.mkdir(parents=True, exist_ok=True)
        trace.write_text('transcript')
        indexed = index_store(self.store, {'selected'})
        self.assertEqual(indexed['selected'].get('result.json'), self.result)
        self.assertEqual(indexed['selected'].get('stdout.txt'), trace)
        self.assertEqual(set(indexed), {'selected'})

    def test_invalid_result_is_not_presented_as_success(self):
        data = json.loads(self.result.read_text())
        data['samples'][0].update(infrastructure_status='invalid', solved=True)
        self.result.write_text(json.dumps(data))
        attempt = Attempt('selected')
        attempt.add_root(self.result.parent)
        row, run = build_run(attempt, 'fable51', 'task', 0, None,
                             collection='figure1_attempt', campaign='campaign')
        self.assertEqual(row['outcome'], 'invalid')
        self.assertEqual(run['infrastructure']['status'], 'invalid')


class RestoreUserMessagesTests(unittest.TestCase):
    def test_task_and_continuation_surround_their_invocations(self):
        events = [
            {"kind": "session_start"},
            {"kind": "text", "text": "Working."},
            {"kind": "stage", "name": "CLI invocation 2"},
            {"kind": "text", "text": "Done."},
        ]
        messages = [
            {"role": "user", "content": "Restore the archive."},
            {"role": "assistant", "content": "Working."},
            {"role": "user", "content": "Please continue."},
        ]
        restored = restore_user_messages(events, messages)
        self.assertEqual([event["kind"] for event in restored],
                         ["session_start", "user", "text", "stage", "user", "text"])
        self.assertEqual(restored[1]["text"], "Restore the archive.")
        self.assertEqual(restored[4]["text"], "Please continue.")

    def test_existing_user_messages_are_preserved_without_duplicates(self):
        events = [
            {"kind": "session_start"},
            {"kind": "user", "text": "Restore the archive."},
            {"kind": "user", "text": "An additional instruction from the stream."},
        ]
        restored = restore_user_messages(events, [
            {"role": "user", "content": "Restore the archive."},
        ])
        self.assertEqual(restored, events)

    def test_internal_retry_does_not_consume_a_continuation(self):
        events = [
            {"kind": "session_start"},
            {"kind": "result", "text": ""},
            {"kind": "stage", "name": "CLI invocation 2"},
            {"kind": "result", "text": "Working.\n"},
            {"kind": "stage", "name": "CLI invocation 3"},
            {"kind": "result", "text": "Done."},
        ]
        restored = restore_user_messages(events, [
            {"role": "user", "content": "Restore the archive."},
            {"role": "assistant", "content": "Working."},
            {"role": "user", "content": "Please continue."},
        ])
        self.assertEqual([event["text"] for event in restored if event["kind"] == "user"],
                         ["Restore the archive.", "Please continue."])
        self.assertEqual(restored[5]["name"], "CLI invocation 3")
        self.assertEqual(restored[6]["text"], "Please continue.")

    def test_full_task_survives_without_session_metadata(self):
        task = "Task details\n" * 500
        restored = restore_user_messages([{"kind": "text", "text": "Working."}], [
            {"role": "user", "content": task},
        ])
        self.assertEqual(restored[0]["text"], task)
        self.assertEqual(restored[0]["source"], "episode record")


if __name__ == "__main__":
    unittest.main()
