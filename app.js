// 1. Initialize map with dark basemap
const map = L.map('map').setView([-35.2809,149.1300],14);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; CartoDB & OpenStreetMap'
}).addTo(map);

// 2. User location marker
let userMarker;
navigator.geolocation.watchPosition(pos => {
  const { latitude, longitude } = pos.coords;
  if (!userMarker) {
    userMarker = L.marker([latitude, longitude]).addTo(map);
  } else {
    userMarker.setLatLng([latitude, longitude]);
  }
});

// 3. Load stop data
let stops = [];
fetch('/data/stops.json')
  .then(r => r.json())
  .then(d => stops = d);

// 4. Tab logic
const tabs = ['plan','nearby'];
tabs.forEach(tab => {
  document.getElementById(`nav-${tab}`).addEventListener('click', () => {
    tabs.forEach(t => {
      document.getElementById(`panel-${t}`)?.classList.add('hidden');
      document.getElementById(`nav-${t}`)?.classList.remove('active');
    });
    document.getElementById(`panel-${tab}`)?.classList.remove('hidden');
    document.getElementById(`nav-${tab}`)?.classList.add('active');
  });
});
// default
document.getElementById('nav-plan').click();

// 5. Panel expand/collapse via handle or input
const panel = document.getElementById('panel-plan');
const handle = document.getElementById('panel-handle');
function togglePanel(expand) {
  panel.classList.toggle('expanded', expand);
  panel.classList.toggle('collapsed', !expand);
}
handle.addEventListener('click', () => togglePanel(!panel.classList.contains('expanded')));
document.getElementById('searchDest').addEventListener('focus', () => togglePanel(true));

// 6. Destination suggestions
const destInput = document.getElementById('searchDest');
destInput.addEventListener('input', () => {
  const val = destInput.value.toLowerCase();
  const suggestions = stops.filter(s => s.name.toLowerCase().includes(val)).slice(0,5);
  const html = suggestions.map(s =>
    `<li class="item" data-name="${s.name}" data-lat="${s.lat}" data-lon="${s.lon}">${s.name}</li>`
  ).join('');
  document.getElementById('route-options').innerHTML = `<ul>${html}</ul>`;
  document.querySelectorAll('#route-options li').forEach(el =>
    el.addEventListener('click', () => selectDestination(el))
  );
});

let selectedRoute;
async function selectDestination(el) {
  const to = el.dataset.name;
  // fetch route options
  const res = await fetch(`/api/routes?to=${encodeURIComponent(to)}`);
  const routes = await res.json();
  document.getElementById('route-options').innerHTML =
    routes.map((r,i) => `<li class="item" data-idx="${i}">${r.summary} (${r.duration}m)</li>`).join('');
  document.querySelectorAll('#route-options li').forEach(li =>
    li.addEventListener('click', () => startLive(routes[li.dataset.idx]))
  );
}

// 7. Start live guidance
function startLive(route) {
  // draw polyline
  if (window.routeLayer) map.removeLayer(window.routeLayer);
  const coords = route.legs.flatMap(l => l.geometry.coordinates.map(c=>[c[1],c[0]]));
  window.routeLayer = L.polyline(coords,{color:'#3B82F6',weight:4}).addTo(map);
  map.fitBounds(window.routeLayer.getBounds(),{padding:[20,20]});
  // show notifications
  route.steps.forEach((step,i) => {
    setTimeout(() => {
      Notification.requestPermission().then(() =>
        new Notification('Next step', { body: step.instruction })
      );
    }, i * 10000);
  });
}

// 8. Nearby stops panel
async function showNearbyStops() {
  const pos = await new Promise(r =>
    navigator.geolocation.getCurrentPosition(p => r(p.coords))
  );
  stops.sort((a,b) => distance(pos,a) - distance(pos,b));
  document.getElementById('nearby-stops').innerHTML =
    stops.slice(0,5).map(s => `<li class="item">${s.name} (${distance(pos,s).toFixed(2)}km)</li>`).join('');
}
function distance(pos,stop) {
  const R = 6371;
  const dLat = (stop.lat - pos.latitude) * Math.PI/180;
  const dLon = (stop.lon - pos.longitude) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(pos.latitude*Math.PI/180)*Math.cos(stop.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
showNearbyStops();
