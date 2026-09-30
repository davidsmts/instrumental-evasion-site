import unittest

from tools.build_traces import restore_user_messages


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
