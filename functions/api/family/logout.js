function jsonResponse(body, { status = 200, cacheControl = 'no-store', headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
      ...headers
    }
  });
}

export async function onRequestPost() {
  return jsonResponse(
    { ok: true },
    {
      status: 200,
      headers: {
        'Set-Cookie': 'whist_family=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
      }
    }
  );
}


