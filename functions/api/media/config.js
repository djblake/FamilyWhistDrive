function jsonResponse(body, { status = 200, cacheControl = 'public, max-age=3600' } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl
    }
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const publicBaseUrl = env && env.WHIST_MEDIA_PUBLIC_BASE_URL ? String(env.WHIST_MEDIA_PUBLIC_BASE_URL) : '';
  const hasBucket = Boolean(env && env.WHIST_MEDIA);

  return jsonResponse({
    publicBaseUrl,
    maxCoverPicks: 3,
    hasBucket
  });
}




