// Map init with dark tiles
const map = L.map('map').setView([-35.2809,149.1300],14);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; CartoDB & OpenStreetMap'
}).addTo(map);

// User location marker
let userMarker;
navigator.geolocation.watchPosition(pos => {
  const { latitude, longitude } = pos.coords;
  if (!userMarker) {
    userMarker = L.marker([latitude, longitude], { icon: L.icon({ iconUrl: '/icons/icon-192.png', iconSize: [32,32] }) }).addTo(map);
  } else {
    userMarker.setLatLng([latitude, longitude]);
  }
}, err => console.error(err));

// Stop data
let stops=[];
fetch('/data/stops.json').then(r=>r.json()).then(d=>stops=d);

// Tabs
const tabs = ['plan','nearby'];
tabs.forEach(tab=>{
  document.getElementById(`nav-${tab}`).addEventListener('click', ()=>{
    tabs.forEach(t=>{
      document.getElementById(`panel-${t}`).classList.add('hidden');
      document.getElementById(`nav-${t}`).classList.remove('active');
    });
    document.getElementById(`panel-${tab}`).classList.remove('hidden');
    document.getElementById(`nav-${tab}`).classList.add('active');
  });
});
// Default
document.getElementById('nav-plan').click();

// Search destination suggestions
const destInput = document.getElementById('searchDest');
destInput.addEventListener('input', ()=>{
  const val = destInput.value.toLowerCase();
  const suggestions = stops.filter(s=>s.name.toLowerCase().includes(val)).slice(0,5);
  const opts = suggestions.map(s=>`<li class="item" data-lat="${s.lat}" data-lon="${s.lon}">${s.name}</li>`).join('');
  document.getElementById('route-options').innerHTML = `<ul>${opts}</ul>`;
  document.querySelectorAll('#route-options li').forEach(el=>{
    el.addEventListener('click', ()=> selectDestination(el));
  });
});

let selectedDest;
function selectDestination(el) {
  selectedDest = { name: el.textContent, lat: el.dataset.lat, lon: el.dataset.lon };
  showRouteOptions(selectedDest);
}

async function showRouteOptions(dest) {
  // Assume API returns several route choices
  const res = await fetch(`/api/routes?to=${encodeURIComponent(dest.name)}`);
  const routes = await res.json();
  const html = routes.map((r,i)=>
    `<li class="item" data-idx="${i}">${r.summary} (${r.duration}m)</li>`
  ).join('');
  document.getElementById('route-options').innerHTML = `<ul>${html}</ul>`;
  document.querySelectorAll('#route-options li').forEach(el=> el.addEventListener('click', ()=> startLive(routes[el.dataset.idx])));
}

function startLive(route) {
  // Draw route
  if (window.routeLayer) map.removeLayer(window.routeLayer);
  const coords = route.legs.flatMap(l=> l.geometry.coordinates.map(c=>[c[1],c[0]]));
  window.routeLayer = L.polyline(coords,{color:'#3B82F6',weight:4,opacity:0.8}).addTo(map);
  map.fitBounds(window.routeLayer.getBounds(),{padding:[20,20]});
  // Show live steps
  document.getElementById('start-live').classList.remove('hidden');
  document.getElementById('start-live').onclick = () => liveGuide(route.steps);
}

function liveGuide(steps) {
  Notification.requestPermission();
  steps.forEach((s,i)=>{
    setTimeout(()=>{
      new Notification('Next step', { body: s.instruction });
      // also display on panel
      const ul = document.getElementById('route-options'); ul.innerHTML = '';
      ul.innerHTML = steps.map((st,j)=> `<li class="item" style="animation-delay:${j*0.1}s">${st.instruction}</li>`).join('');
    }, i * 15000);
  });
}

// Nearby stops
async function showNearbyStops() {
  const pos = await new Promise(r=>navigator.geolocation.getCurrentPosition(p=>r(p.coords)));
  stops.sort((a,b)=> dist(pos,a)-dist(pos,b));
  const html = stops.slice(0,5).map((s,i)=>`<li class="item">${s.name} (${dist(pos,s).toFixed(2)}km)</li>`).join('');
  document.getElementById('nearby-stops').innerHTML = html;
}
function dist(pos,s){ const R=6371; const dLat=(s.lat-pos.latitude)*Math.PI/180; const dLon=(s.lon-pos.longitude)*Math.PI/180; const a=Math.sin(dLat/2)**2+Math.cos(pos.latitude*Math.PI/180)*Math.cos(s.lat*Math.PI/180)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(a)); }
showNearbyStops();
