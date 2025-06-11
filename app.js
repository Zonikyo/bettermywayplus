// Initialize map
const map = L.map('map').setView([-35.2809,149.1300],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Utility: fetch and cache GTFS static timetable
async function loadTimetable() {
  const url = 'https://api.transport.act.gov.au/lightrail/gtfs/static/timetable.json';
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch (e) {
    const cache = await caches.open('transit-data');
    const cached = await cache.match(url);
    return cached ? cached.json() : null;
  }
}

// Utility: fetch GTFS-R real-time feed
async function loadRealtime() {
  const url = 'https://api.transport.act.gov.au/lightrail/gtfs/realtime';
  try {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    // parse protobuf GTFS-R here or show raw
    return buffer;
  } catch (e) {
    const cache = await caches.open('transit-data');
    const cached = await cache.match(url);
    return cached ? cached.arrayBuffer() : null;
  }
}

// Trip planning via third-party API (e.g. OpenTripPlanner)
async function planTrip(from, to) {
  const url = `https://routing.canberra.example/plan?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url);
  return res.json();
}

// Form submission
document.getElementById('trip-form').addEventListener('submit', async e => {
  e.preventDefault();
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const plan = await planTrip(from, to);
  displayItinerary(plan);
});

// Display itinerary on map and list
function displayItinerary(plan) {
  document.getElementById('itinerary').innerHTML = '';
  // Clear existing layers
  map.eachLayer(layer => { if (layer instanceof L.Polyline) map.removeLayer(layer); });

  plan.legs.forEach(leg => {
    const li = document.createElement('li');
    li.textContent = `${leg.mode}: ${leg.from.name} → ${leg.to.name} (${leg.duration} mins)`;
    document.getElementById('itinerary').appendChild(li);

    const coords = leg.geometry.coordinates.map(c => [c[1], c[0]]);
    L.polyline(coords).addTo(map);
  });
}

// Preload and cache GTFS on load
loadTimetable();
loadRealtime();
