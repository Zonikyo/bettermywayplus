// script.js
const API_KEY = '12f16e0e9e72b49e496279d8230b0fec';
const map = L.map('map').setView([-35.2809, 149.13], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
let vehicleMarkers = [];

document.getElementById('tripForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;

  const tripResponse = await fetch(`https://tripgo.skedgo.com/v1/routing.json?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&region=au_canberra&locale=en&realtime=true`, {
    headers: {
      'Accept': 'application/json',
      'X-TripGo-Key': API_KEY
    }
  });

  const data = await tripResponse.json();
  displayTrips(data.suggestions[0]?.trips || []);
});

function displayTrips(trips) {
  const results = document.getElementById('tripResults');
  results.innerHTML = '';
  if (!trips.length) return results.innerHTML = '<p>No trips found.</p>';

  trips.forEach(trip => {
    const segments = trip.segments.map(seg => seg.transportMode ? `<li>${seg.transportMode} from ${seg.startTime}</li>` : '').join('');
    const tripEl = document.createElement('div');
    tripEl.innerHTML = `<ul>${segments}</ul>`;
    results.appendChild(tripEl);
  });
}

async function fetchLiveVehicles() {
  try {
    const res = await fetch('https://tripgo.skedgo.com/v1/publictransport/vehicle_locations?region=au_canberra', {
      headers: {
        'Accept': 'application/json',
        'X-TripGo-Key': API_KEY
      }
    });

    const data = await res.json();
    updateVehicleMarkers(data.vehicles || []);
  } catch (err) {
    console.error('Failed to fetch vehicle locations', err);
  }
}

function updateVehicleMarkers(vehicles) {
  vehicleMarkers.forEach(m => map.removeLayer(m));
  vehicleMarkers = [];

  vehicles.forEach(vehicle => {
    if (!vehicle.location) return;
    const marker = L.circleMarker([vehicle.location.lat, vehicle.location.lon], {
      radius: 6,
      fillColor: 'red',
      color: 'white',
      fillOpacity: 0.9
    }).bindPopup(`Vehicle ID: ${vehicle.id}`);
    marker.addTo(map);
    vehicleMarkers.push(marker);
  });
}

// Refresh vehicle data every 30s
fetchLiveVehicles();
setInterval(fetchLiveVehicles, 30000);
