export async function onRequestGet(context) {
  const { env } = context;
  const kv = env && env.WHIST_CACHE;
  if (!kv) {
    return new Response(
      JSON.stringify({ error: 'KV binding WHIST_CACHE not configured' }),
      { status: 501, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }

  const raw = await kv.get('manifest');
  const manifest = raw ? JSON.parse(raw) : null;

  return new Response(JSON.stringify(manifest || { exists: false }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Always revalidate to pick up updates immediately.
      'Cache-Control': 'no-store'
    }
  });
}


