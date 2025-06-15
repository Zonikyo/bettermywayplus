import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

const API_KEY = '12f16e0e9e72b49e496279d8230b0fec';
const BASE    = 'https://api.tripgo.com/v1/';

addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    // Handle all /api/* by proxying to TripGo
    const endpoint = url.pathname.replace('/api/', '');
    const tripgoUrl = new URL(BASE + endpoint + '.json');
    tripgoUrl.search = url.search;

    event.respondWith(proxyTripGo(tripgoUrl));
  } else {
    // Serve static assets from the `public/` bucket
    event.respondWith(serveAsset(event));
  }
});

async function proxyTripGo(tripgoUrl) {
  const resp = await fetch(tripgoUrl.toString(), {
    headers: {
      'X-TripGo-Key': API_KEY,
      'Accept': 'application/json'
    }
  });
  const body = await resp.text();
  return new Response(body, {
    status: resp.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function serveAsset(event) {
  try {
    // `getAssetFromKV` will fetch from the KV namespace bound to this Site
    return await getAssetFromKV(event);
  } catch (e) {
    // Fallback to index.html for SPA routing
    return await getAssetFromKV(event, { mapRequestToAsset: req => new Request(`${new URL(req.url).origin}/index.html`, req) });
  }
}
