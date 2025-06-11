// Initialize map
const map = L.map('map').setView([-35.2809,149.1300],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(map);
let routeLayer;

// Load stops
let stops = [];
fetch('/data/stops.json').then(r=>r.json()).then(data=> stops=data);
['from','to'].forEach(id=>{
  const inp=document.getElementById(id);
  inp.addEventListener('input', ()=>{
    const list=document.getElementById('stops'); list.innerHTML='';
    stops.filter(s=>s.name.toLowerCase().includes(inp.value.toLowerCase())).slice(0,5)
      .forEach(s=>{ const opt=document.createElement('option'); opt.value=s.name; list.appendChild(opt); });
  });
});

// Tabs
const tabs=['plan','nearby','live'];
tabs.forEach(tab=>{
  document.querySelector(`button[data-tab="${tab}"]`).addEventListener('click', ()=>{
    tabs.forEach(t=>{
      document.getElementById(`tab-${t}`).classList.add('hidden');
      document.querySelector(`button[data-tab="${t}"]`).classList.remove('active');
    });
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.querySelector(`button[data-tab="${tab}"]`).classList.add('active');
  });
});
// Activate default
document.querySelector('button[data-tab="plan"]').click();

// Now button
document.getElementById('now-btn').addEventListener('click', ()=>{
  document.getElementById('datetime').value = new Date().toISOString().slice(0,16);
});

// Plan trip
document.getElementById('plan-btn').addEventListener('click', async ()=>{
  const from=document.getElementById('from').value;
  const to=document.getElementById('to').value;
  const time=document.getElementById('datetime').value || new Date().toISOString();
  const res=await fetch(`/api/plan?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&time=${encodeURIComponent(time)}`);
  const plan=await res.json();
  showItinerary(plan);
});
function showItinerary(plan){
  const ul=document.getElementById('itinerary'); ul.innerHTML=''; if(routeLayer) map.removeLayer(routeLayer);
  let coords=[];
  plan.legs.forEach((leg,i)=>{
    coords.push(...leg.geometry.coordinates.map(c=>[c[1],c[0]]));
    const li=document.createElement('li'); li.className='itinerary-item';
    li.style.animationDelay=`${i*0.1}s`;
    li.textContent = `${leg.mode}: ${leg.from.name} → ${leg.to.name} (${leg.duration}m)`;
    ul.appendChild(li);
  });
  routeLayer=L.polyline(coords,{color:'#3B82F6',weight:4,opacity:0.8}).addTo(map);
  map.fitBounds(routeLayer.getBounds(),{padding:[20,20]});
}

// Nearby stops
async function showNearby(){
  const pos = await new Promise(r=>navigator.geolocation.getCurrentPosition(p=>r(p.coords)));
  stops.sort((a,b)=> getDistance(pos,a) - getDistance(pos,b));
  const ul=document.getElementById('nearby-stops'); ul.innerHTML='';
  stops.slice(0,5).forEach((s,i)=>{
    const li=document.createElement('li'); li.className='nearby-item';
    li.style.animationDelay=`${i*0.1}s`;
    li.textContent = `${s.name} (${getDistance(pos,s).toFixed(2)} km)`;
    ul.appendChild(li);
    L.circleMarker([s.lat,s.lon],{radius:6,color:'#60A5FA'}).addTo(map);
  });
}
function getDistance(pos,stop){ const R=6371; const dLat=(stop.lat-pos.latitude)*Math.PI/180; const dLon=(stop.lon-pos.longitude)*Math.PI/180; const a=Math.sin(dLat/2)**2+Math.cos(pos.latitude*Math.PI/180)*Math.cos(stop.lat*Math.PI/180)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(a)); }

// Live stub
document.getElementById('tab-live').addEventListener('show', ()=>{});
function showLive(steps){
  document.querySelector('button[data-tab="live"]').click();
  const ul=document.getElementById('live-steps'); ul.innerHTML='';
  steps.forEach((s,i)=>{
    const li=document.createElement('li'); li.className='live-item';
    li.style.animationDelay=`${i*0.1}s`;
    li.textContent = s.instruction;
    ul.appendChild(li);
  });
}
