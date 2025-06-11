// Map init
const map = L.map('map').setView([-35.2809,149.1300],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(map);
let routeLayer;

// Utility: Geolocation & Nearby stops
async function getStops() {
  const res = await fetch('/data/stops.json'); const stops = await res.json();
  return stops;
}
function distance(a,b){ const R=6371; const dLat=(b.lat-a.lat)*Math.PI/180; const dLon=(b.lon-a.lon)*Math.PI/180;
  const va=Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(va));
}

// Display Nearby
async function showNearby(){
  const pos = await new Promise(r=>navigator.geolocation.getCurrentPosition(p=>r(p.coords)));
  const stops = await getStops();
  const nearby = stops.map(s=>({...s, dist:distance({lat:pos.latitude,lon:pos.longitude},s)}))
    .filter(s=>s.dist<1).sort((a,b)=>a.dist-b.dist);
  const ul = document.getElementById('nearby-stops'); ul.innerHTML='';
  nearby.slice(0,10).forEach((s,i)=>{
    const li=document.createElement('li'); li.className='nearby-item p-2 bg-white dark:bg-gray-700 rounded-lg shadow';
    li.style.animationDelay=`${i*0.1}s`; li.textContent=`${s.name} (${s.dist.toFixed(2)} km)`;
    ul.appendChild(li);
    L.marker([s.lat,s.lon],{riseOnHover:true}).addTo(map);
  });
}
showNearby();

// Plan trip
async function planTrip(from,to,datetime){
  // fetch timetable & routes
  const url = `https://routing.canberra.example/plan?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&time=${datetime}`;
  const res=await fetch(url); return res.json();
}
document.getElementById('trip-form').addEventListener('submit', async e=>{
  e.preventDefault(); const {from,to,datetime} = e.target;
  const plan = await planTrip(from.value,to.value,datetime.value);
  displayItinerary(plan);
});
async function displayItinerary(plan){
  const list=document.getElementById('itinerary'); list.innerHTML=''; if(routeLayer)map.removeLayer(routeLayer);
  let coords=[];
  plan.legs.forEach((leg,i)=>{
    leg.geometry.coordinates.forEach(c=>coords.push([c[1],c[0]]));
    const li=document.createElement('li'); li.className='itinerary-item p-3 bg-white dark:bg-gray-700 rounded-lg';
    li.style.animationDelay=`${i*0.1}s`;
    li.innerHTML=`<strong>${leg.mode}</strong>: ${leg.from.name}→${leg.to.name} (${leg.duration}m)`;
    list.appendChild(li);
  });
  routeLayer=L.polyline(coords,{className:'animated-route',weight:4}).addTo(map);
  map.fitBounds(routeLayer.getBounds(),{padding:[20,20]});
}

// Live directions (onboard detection & step-by-step stub)
function startLive(steps){
  document.querySelector('.tab-btn[data-tab="live"]').click();
  const ul=document.getElementById('live-steps'); ul.innerHTML='';
  steps.forEach((s,i)=>{
    const li=document.createElement('li'); li.className='live-item p-3 bg-white dark:bg-gray-700 rounded-lg';
    li.style.animationDelay=`${i*0.1}s`; li.textContent=s.instruction;
    ul.appendChild(li);
  });
  // TODO: use geolocation.watchPosition to detect onboard & arrival
}

// Pre-cache GTFS & real-time feeds
async function cacheGtfs(path){ try{const res=await fetch(path);const cache=await caches.open('transit-data');cache.put(path,res);}catch{} }
cacheGtfs('https://api.transport.act.gov.au/lightrail/gtfs/static/timetable.json');
cacheGtfs('https://api.transport.act.gov.au/lightrail/gtfs/realtime');
