const API_KEY = "12f16e0e9e72b49e496279d8230b0fec";
const REGION = "au-act";
const AUTOCOMPLETE_URL = `https://tripgo.skedgo.com/v1/places.json`;
const ROUTING_URL = `https://tripgo.skedgo.com/v1/routing.json`;

const map = L.map("map-container", {
  zoomControl: false,
  attributionControl: false
}).setView([-35.2809, 149.13], 14);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// Add custom location button
L.control.zoom({ position: 'topright' }).addTo(map);
const locateBtn = L.control({ position: 'topright' });
locateBtn.onAdd = () => {
  const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
  btn.innerHTML = '<i class="fas fa-location-crosshairs" style="padding:10px;"></i>';
  btn.style.backgroundColor = "#333";
  btn.style.cursor = "pointer";
  btn.onclick = () => map.locate({ setView: true, maxZoom: 16 });
  return btn;
};
locateBtn.addTo(map);

let userCoords = null;

map.on("locationfound", (e) => {
  userCoords = [e.latitude, e.longitude];
  L.marker(userCoords).addTo(map).bindPopup("You are here").openPopup();
  showNearbyStops();
});

map.on("locationerror", () => {
  alert("Unable to access your location.");
});

// Try to get user location at startup
map.locate({ setView: true, maxZoom: 16 });

const destinationInput = document.getElementById("destination-input");
const planBtn = document.getElementById("plan-btn");
const tripScreen = document.getElementById("trip-screen");
const tripList = document.getElementById("trip-options");

// Autocomplete destinations
destinationInput.addEventListener("input", async (e) => {
  const query = e.target.value;
  if (query.length < 3) return;

  const res = await fetch(`${AUTOCOMPLETE_URL}?region=${REGION}&text=${encodeURIComponent(query)}`, {
    headers: { Authorization: API_KEY }
  });
  const data = await res.json();

  // Remove old suggestions
  let ac = document.getElementById("autocomplete");
  if (ac) ac.remove();

  const container = document.createElement("div");
  container.id = "autocomplete";
  data.places.slice(0, 5).forEach(place => {
    const div = document.createElement("div");
    div.textContent = place.name;
    div.onclick = () => {
      destinationInput.value = place.name;
      container.remove();
      planTrip(place);
    };
    container.appendChild(div);
  });

  destinationInput.parentNode.appendChild(container);
});

// Trip Planning
planBtn.addEventListener("click", () => {
  const input = destinationInput.value;
  if (!input || !userCoords) return;
  resolveAddress(input).then(place => planTrip(place));
});

async function resolveAddress(address) {
  const res = await fetch(`${AUTOCOMPLETE_URL}?region=${REGION}&text=${encodeURIComponent(address)}`, {
    headers: { Authorization: API_KEY }
  });
  const data = await res.json();
  return data.places[0];
}

async function planTrip(destinationPlace) {
  const url = `${ROUTING_URL}?fromLat=${userCoords[0]}&fromLon=${userCoords[1]}&toLat=${destinationPlace.lat}&toLon=${destinationPlace.lon}&region=${REGION}`;
  const res = await fetch(url, {
    headers: { Authorization: API_KEY }
  });
  const data = await res.json();
  displayTrips(data);
}

function displayTrips(tripData) {
  tripScreen.classList.remove("hidden");
  tripList.innerHTML = "";

  if (!tripData.itineraries || tripData.itineraries.length === 0) {
    tripList.innerHTML = "<li>No routes found.</li>";
    return;
  }

  tripData.itineraries.forEach((itinerary) => {
    const li = document.createElement("li");
    const summary = itinerary.legs.map(l => l.transportation.mode).join(" → ");
    li.innerHTML = `<strong>${summary}</strong><br>${itinerary.legs.length} steps · ${(itinerary.duration / 60).toFixed(0)} mins`;
    tripList.appendChild(li);
  });
}

// Show nearby stops
async function showNearbyStops() {
  if (!userCoords) return;

  const res = await fetch(`https://tripgo.skedgo.com/v1/stops/byLatLon.json?lat=${userCoords[0]}&lon=${userCoords[1]}&region=${REGION}`, {
    headers: { Authorization: API_KEY }
  });
  const data = await res.json();

  data.stops.slice(0, 5).forEach(stop => {
    const marker = L.circleMarker([stop.lat, stop.lon], {
      radius: 6,
      color: "#00c853",
      fillColor: "#00c853",
      fillOpacity: 0.7
    }).addTo(map);
    marker.bindPopup(`<strong>${stop.name}</strong><br>${stop.code}`);
  });
}
