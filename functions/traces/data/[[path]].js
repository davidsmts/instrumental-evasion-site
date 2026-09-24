export async function onRequest(context) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' }
    });
  }

  const parts = context.params.path;
  const key = Array.isArray(parts) ? parts.join('/') : String(parts || '');
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });

  if (!context.env.TRACE_DATA) {
    return new Response('Trace storage is not configured', { status: 503 });
  }

  const object = await context.env.TRACE_DATA.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', 'application/javascript; charset=utf-8');
  headers.set('ETag', object.httpEtag);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set(
    'Cache-Control',
    key === 'index.js'
      ? 'public, max-age=300'
      : 'public, max-age=31536000, immutable'
  );

  return new Response(context.request.method === 'HEAD' ? null : object.body, {
    status: 200,
    headers
  });
}
