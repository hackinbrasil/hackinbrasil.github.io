const SECURITY_HEADERS = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
  "Cross-Origin-Embedder-Policy": "unsafe-none",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
  "Clear-Site-Data": "\"cache\"",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https://hackinbrasil-meetup-api.hi-c21.workers.dev",
    "frame-src https://airtable.com https://www.google.com https://maps.google.com",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; ")
};

function buildUpstreamUrl(requestUrl, upstreamOrigin) {
  const source = new URL(requestUrl);
  const target = new URL(upstreamOrigin);
  target.pathname = source.pathname;
  target.search = source.search;
  return target.toString();
}

export default {
  async fetch(request, env) {
    if (!env.UPSTREAM_ORIGIN) {
      return new Response("Missing UPSTREAM_ORIGIN env var", { status: 500 });
    }

    const upstreamUrl = buildUpstreamUrl(request.url, env.UPSTREAM_ORIGIN);
    const upstreamRequest = new Request(upstreamUrl, request);
    const upstreamResponse = await fetch(upstreamRequest);

    const headers = new Headers(upstreamResponse.headers);
    for (const [headerName, headerValue] of Object.entries(SECURITY_HEADERS)) {
      headers.set(headerName, headerValue);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers
    });
  }
};
