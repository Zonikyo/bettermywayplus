const API_KEY = '12f16e0e9e72b49e496279d8230b0fec';
const BASE    = 'https://api.tripgo.com/v1/';

addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/api/')) {
    return event.respondWith(fetch(event.request));
  }

  const endpoint = url.pathname.replace('/api/', '');
  const tripgoUrl = new URL(BASE + endpoint + '.json');
  tripgoUrl.search = url.search;

  event.respondWith(handle(tripgoUrl));
});

async function handle(tripgoUrl) {
  const headers = {
    'X-TripGo-Key': API_KEY,
    'Accept': 'application/json'
  };
  const resp = await fetch(tripgoUrl.toString(), { headers });
  const body = await resp.json();
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
