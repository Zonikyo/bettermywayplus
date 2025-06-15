// ==== GLOBAL STATE ====
let deferredPrompt;

// ==== PWA INSTALL PROMPT ====
const installBanner = document.getElementById('installBanner');
const installBtn    = document.getElementById('installBtn');
const dismissBtn    = document.getElementById('dismissInstall');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
  installBanner.classList.add('hidden');
  deferredPrompt.prompt();
  deferredPrompt = null;
});
dismissBtn.addEventListener('click', () => {
  installBanner.classList.add('hidden');
});

// ==== LOADING SPINNER ====
const spinner = document.getElementById('spinner');
function showLoading() { spinner.classList.remove('hidden'); }
function hideLoading() { spinner.classList.add('hidden'); }

// ==== MAP SETUP ====
const map = L.map('map', { zoomControl: false, attributionControl: false })
  .setView([-35.2809, 149.1300], 13);
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
const userIcon = L.icon({ iconUrl: 'icons/location-arrow.svg', iconSize: [32,32], iconAnchor: [16,16] });
const userMarker = L.marker([0,0], { icon: userIcon }).addTo(map);
navigator.geolocation.watchPosition(pos => {
  const { latitude, longitude, heading } = pos.coords;
  userMarker.setLatLng([latitude, longitude]);
  userMarker.setRotationAngle(heading || 0);
  map.setView([latitude, longitude], map.getZoom());
});
// vehicle layer
const vehicleLayer = L.layerGroup().addTo(map);
async function fetchVehicles() {
  const bounds = map.getBounds().toBBoxString();
  const res = await fetch(`/api/vehicles?bbox=${bounds}`);
  const data = await res.json();
  vehicleLayer.clearLayers();
  data.vehicles.forEach(v => {
    L.circleMarker([v.lat, v.lon], { radius: 4, opacity: 0.8, fillOpacity: 0.6 })
      .bindTooltip(`${v.route} (${v.delay>0? '+'+v.delay+'s':'on time'})`)
      .addTo(vehicleLayer);
  });
}
// poll every 10s
setInterval(fetchVehicles, 10000);

// ==== AUTOCOMPLETE FOR “TO” FIELD ====
const toInput = document.getElementById('to');
const placesAutocomplete = places({  
  appId: '<YOUR_ALGOLIA_APP_ID>',
  apiKey: '<YOUR_ALGOLIA_SEARCH_KEY>',
  container: toInput
});
placesAutocomplete.on('change', e => {
  toInput.value = e.suggestion.latlng.join(',');
});

// ==== ELEMENTS & UTILS ====
const fromInput = document.getElementById('from');
const planBtn   = document.getElementById('planBtn');
const itinerary = document.getElementById('itinerary');
navigator.geolocation.getCurrentPosition(p => {
  fromInput.value = `${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`;
});

// ==== TRIP PLANNING ====
async function planTrip() {
  const from = fromInput.value, to = toInput.value.trim();
  if (!to) return alert('Enter a destination');
  itinerary.innerHTML = '';
  showLoading();

  try {
    const res = await fetch(`/api/routing?from=${from}&to=${to}`);
    const data = await res.json();
    if (!data.trips?.length) throw new Error('No trips found');

    // draw first trip
    const trip = data.trips[0];
    // animate itinerary items
    trip.segments.forEach((seg,i) => {
      const li = document.createElement('li');
      li.textContent = `${seg.mode.toUpperCase()}: ${seg.instruction} (${Math.ceil(seg.duration/60)} min)`;
      itinerary.appendChild(li);
      anime({
        targets: li,
        opacity: [0,1],
        translateX: [-20,0],
        delay: i * 100
      });

      // if this is a stop segment, fetch next departures
      if (seg.mode === 'bus' && seg.stopId) {
        fetch(`/api/timetable?stopId=${seg.stopId}`)
          .then(r => r.json())
          .then(tt => {
            const next = tt.departures.slice(0,3).map(d => d.time).join(', ');
            li.textContent += ` — Next: ${next}`;
          });
      }
    });

    // draw route line
    const coords = trip.segments.flatMap(s => s.shape);
    L.polyline(coords, { weight: 4, opacity: 0.8 }).addTo(map);
  } catch (err) {
    const li = document.createElement('li');
    li.textContent = err.message;
    itinerary.appendChild(li);
  } finally {
    hideLoading();
  }
}

planBtn.addEventListener('click', planTrip);
toInput.addEventListener('keyup', e => { if (e.key==='Enter') planTrip(); });