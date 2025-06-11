// Initialize
const map = L.map('map').setView([-35.2809,149.1300],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
let routeLayer;

// Loader handlers
const loader = document.getElementById('loader');
function showLoader() { loader.classList.remove('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }

// Fetch stops for autocomplete
async function loadStops() {
  const res = await fetch('/data/stops.json');
  const stops = await res.json();
  const dl = document.getElementById('stops');
  stops.forEach(s => {
    const opt = document.createElement('option'); opt.value = s.name;
    dl.appendChild(opt);
  });
}
loadStops();

// Trip planning
async function planTrip(from, to, datetime) {
  showLoader();
  const url = `https://routing.canberra.example/plan?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&time=${encodeURIComponent(datetime)}`;
  const res = await fetch(url);
  const plan = await res.json();
  hideLoader();
  return plan;
}

// Display itinerary
async function displayItinerary(plan) {
  const list = document.getElementById('itinerary');
  list.innerHTML = '';
  if (routeLayer) map.removeLayer(routeLayer);

  const coords = [];
  plan.legs.forEach((leg, i) => {
    leg.geometry.coordinates.forEach(c => coords.push([c[1], c[0]]));
    const li = document.createElement('li');
    li.className = 'itinerary-item bg-white p-3 rounded-lg shadow-sm';
    li.style.animationDelay = `${i * 0.1}s`;
    li.innerHTML = `<strong>${leg.mode}</strong>: ${leg.from.name} → ${leg.to.name} (${leg.duration} mins)`;
    list.appendChild(li);
  });
  // Draw polyline
  routeLayer = L.polyline(coords, { className: 'animated-route', weight: 4 }).addTo(map);
  map.fitBounds(routeLayer.getBounds(), { padding: [20,20] });
}

// Form handler
document.getElementById('trip-form').addEventListener('submit', async e => {
  e.preventDefault();
  const from = e.target.from.value;
  const to = e.target.to.value;
  const datetime = e.target.datetime.value || new Date().toISOString();
  const plan = await planTrip(from, to, datetime);
  displayItinerary(plan);
});

// Pre-cache GTFS data (unchanged)
async function cacheGtfs(path) {
  try {
    const res = await fetch(path);
    const cache = await caches.open('transit-data');
    cache.put(path, res.clone());
  } catch {}
}
cacheGtfs('https://api.transport.act.gov.au/lightrail/gtfs/static/timetable.json');
cacheGtfs('https://api.transport.act.gov.au/lightrail/gtfs/realtime');
