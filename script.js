const API_KEY = '12f16e0e9e72b49e496279d8230b0fec';
let userLocation = null;

navigator.geolocation.getCurrentPosition(async pos => {
  userLocation = {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude
  };
  fetchNearby();
}, () => alert("Location permission denied. Cannot load nearby stops."));

document.getElementById('to').addEventListener('input', async (e) => {
  const query = e.target.value;
  if (query.length < 3) return document.getElementById('autocomplete').innerHTML = "";

  const res = await fetch(`https://tripgo.skedgo.com/v1/places.json?query=${encodeURIComponent(query)}&location=${userLocation.lat},${userLocation.lon}&region=au_canberra`, {
    headers: { 'X-TripGo-Key': API_KEY }
  });
  const data = await res.json();
  const results = data.places;
  const list = document.getElementById('autocomplete');
  list.innerHTML = "";
  results.forEach(place => {
    const li = document.createElement('li');
    li.textContent = place.name;
    li.onclick = () => {
      document.getElementById('to').value = place.name;
      list.innerHTML = "";
    };
    list.appendChild(li);
  });
});

async function fetchNearby() {
  const stopsRes = await fetch(`https://tripgo.skedgo.com/v1/publictransport/stops_nearby?location=${userLocation.lat},${userLocation.lon}&region=au_canberra`, {
    headers: { 'X-TripGo-Key': API_KEY }
  });
  const stops = await stopsRes.json();
  document.getElementById('stopsList').innerHTML = stops.stops.slice(0, 5).map(s => `<li>${s.name}</li>`).join('');

  const routesRes = await fetch(`https://tripgo.skedgo.com/v1/publictransport/routes_nearby?location=${userLocation.lat},${userLocation.lon}&region=au_canberra`, {
    headers: { 'X-TripGo-Key': API_KEY }
  });
  const routes = await routesRes.json();
  document.getElementById('routesList').innerHTML = routes.routes.slice(0, 5).map(r => `<li>${r.name}</li>`).join('');
}

async function planTrip() {
  const to = document.getElementById('to').value;
  if (!userLocation) return alert("Still determining your location...");

  const res = await fetch(`https://tripgo.skedgo.com/v1/routing.json?from=${userLocation.lat},${userLocation.lon}&to=${encodeURIComponent(to)}&region=au_canberra&realtime=true`, {
    headers: { 'X-TripGo-Key': API_KEY }
  });
  const data = await res.json();
  const trips = data.suggestions[0]?.trips || [];

  document.getElementById('home').style.display = 'none';
  document.getElementById('results').style.display = 'block';

  const resultDiv = document.getElementById('tripResults');
  resultDiv.innerHTML = '';
  trips.forEach(trip => {
    const segments = trip.segments.map(s =>
      `<li>${s.transportMode || 'Walk'} - ${s.startTime} → ${s.endTime}</li>`
    ).join('');
    const card = document.createElement('div');
    card.innerHTML = `<ul>${segments}</ul>`;
    resultDiv.appendChild(card);
  });
}

function goBack() {
  document.getElementById('home').style.display = 'block';
  document.getElementById('results').style.display = 'none';
}
