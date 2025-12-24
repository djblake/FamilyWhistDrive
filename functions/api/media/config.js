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
  const { env, request } = context;
  const publicBaseUrl = env && env.WHIST_MEDIA_PUBLIC_BASE_URL ? String(env.WHIST_MEDIA_PUBLIC_BASE_URL) : '';
  const hasBucket = Boolean(env && env.WHIST_MEDIA);
  const origin = request ? new URL(request.url).origin : '';
  const gatewayBaseUrl = origin ? `${origin}/media` : '';

  return jsonResponse({
    publicBaseUrl,
    gatewayBaseUrl,
    maxCoverPicks: 3,
    hasBucket
  });
}




