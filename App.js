const API_KEY = "12f16e0e9e72b49e496279d8230b0fec";
const REGION = "au-act";
const AUTOCOMPLETE_URL = `https://tripgo.skedgo.com/v1/places.json`;
const ROUTING_URL = `https://tripgo.skedgo.com/v1/routing.json`;

let userCoords = null;
let directionMarker = null;

const map = L.map("map-container", {
  zoomControl: false,
  attributionControl: false
}).setView([-35.28, 149.13], 14);

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  subdomains: "abcd",
  maxZoom: 19
}).addTo(map);

L.control.zoom({ position: "topright" }).addTo(map);

// Custom location button
const locateBtn = L.control({ position: "topright" });
locateBtn.onAdd = () => {
  const btn = L.DomUtil.create("div", "leaflet-bar leaflet-control leaflet-control-custom");
  btn.innerHTML = '<i class="fas fa-location-crosshairs" style="padding:10px;"></i>';
  btn.style.backgroundColor = "#333";
  btn.style.cursor = "pointer";
  btn.onclick = () => map.locate({ setView: true, maxZoom: 16 });
  return btn;
};
locateBtn.addTo(map);

// Handle geolocation and heading
map.on("locationfound", (e) => {
  userCoords = [e.latitude, e.longitude];
  const angle = e.heading || 0;

  if (directionMarker) {
    map.removeLayer(directionMarker);
  }

  directionMarker = L.marker(userCoords, {
    icon: L.divIcon({
      className: "user-direction-marker",
      html: `<div style="transform: rotate(${angle}deg);">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
  }).addTo(map);

  showNearbyStops();
  updateStopList();
});

map.on("locationerror", () => {
  alert("Could not access location.");
});

map.locate({ setView: true, maxZoom: 16, watch: true, enableHighAccuracy: true });

// Search handling
const destinationInput = document.getElementById("destination-input");
const planBtn = document.getElementById("plan-btn");
const tripScreen = document.getElementById("trip-screen");
const tripList = document.getElementById("trip-options");
const setHomeBtn = document.getElementById("set-home");
const setWorkBtn = document.getElementById("set-work");
const stopsList = document.getElementById("stops-list");

destinationInput.addEventListener("input", async () => {
  const query = destinationInput.value;
  if (query.length < 2) return;

  const res = await fetch(`${AUTOCOMPLETE_URL}?region=${REGION}&text=${encodeURIComponent(query)}`, {
    headers: { Authorization: API_KEY }
  });
  const data = await res.json();

  let ac = document.getElementById("autocomplete");
  if (ac) ac.remove();

  const container = document.createElement("div");
  container.id = "autocomplete";
  data.places.slice(0, 6).forEach(place => {
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

destinationInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    planFromInput();
  }
});

planBtn.addEventListener("click", () => {
  planFromInput();
});

function planFromInput() {
  const input = destinationInput.value;
  if (!input || !userCoords) return;
  resolveAddress(input).then(place => planTrip(place));
}

async function resolveAddress(text) {
  const res = await fetch(`${AUTOCOMPLETE_URL}?region=${REGION}&text=${encodeURIComponent(text)}`, {
    headers: { Authorization: API_KEY }
  });
  const data = await res.json();
  return data.places[0];
}

async function planTrip(destination) {
  const url = `${ROUTING_URL}?fromLat=${userCoords[0]}&fromLon=${userCoords[1]}&toLat=${destination.lat}&toLon=${destination.lon}&region=${REGION}`;
  const res = await fetch(url, {
    headers: { Authorization: API_KEY }
  });
  const data = await res.json();
  displayTrips(data);
}

function displayTrips(data) {
  tripScreen.classList.remove("hidden");
  tripList.innerHTML = "";

  if (!data.itineraries || data.itineraries.length === 0) {
    tripList.innerHTML = "<li>No routes found.</li>";
    return;
  }

  data.itineraries.forEach(it => {
    const li = document.createElement("li");
    const summary = it.legs.map(l => l.transportation.mode).join(" → ");
    li.innerHTML = `<strong>${summary}</strong><br>${it.legs.length} steps · ${(it.duration / 60).toFixed(0)} mins`;
    tripList.appendChild(li);
  });
}

async function showNearbyStops() {
  if (!userCoords) return;

  const res = await fetch(`https://tripgo.skedgo.com/v1/stops/byLatLon.json?lat=${userCoords[0]}&lon=${userCoords[1]}&region=${REGION}`, {
    headers: { Authorization: API_KEY }
  });
  const data = await res.json();

  data.stops.slice(0, 6).forEach(stop => {
    const marker = L.circleMarker([stop.lat, stop.lon], {
      radius: 6,
      color: "#00c853",
      fillColor: "#00c853",
      fillOpacity: 0.7
    }).addTo(map);
    marker.bindPopup(`<strong>${stop.name}</strong><br>${stop.code}`);
  });

  localStorage.setItem("nearbyStops", JSON.stringify(data.stops));
  updateStopList();
}

function updateStopList() {
  const raw = localStorage.getItem("nearbyStops");
  if (!raw) return;

  const stops = JSON.parse(raw);
  stopsList.innerHTML = "";
  stops.slice(0, 5).forEach(stop => {
    const li = document.createElement("li");
    li.textContent = stop.name;
    stopsList.appendChild(li);
  });
}

// Save Home/Work
setHomeBtn.addEventListener("click", () => {
  const value = destinationInput.value;
  if (!value) return;
  localStorage.setItem("savedHome", value);
  setHomeBtn.innerHTML = '<i class="fas fa-home"></i> Home Saved!';
});

setWorkBtn.addEventListener("click", () => {
  const value = destinationInput.value;
  if (!value) return;
  localStorage.setItem("savedWork", value);
  setWorkBtn.innerHTML = '<i class="fas fa-briefcase"></i> Work Saved!';
});

// Load saved Home/Work on input focus
destinationInput.addEventListener("focus", () => {
  const home = localStorage.getItem("savedHome");
  const work = localStorage.getItem("savedWork");

  let ac = document.getElementById("autocomplete");
  if (ac) ac.remove();

  const container = document.createElement("div");
  container.id = "autocomplete";

  if (home) {
    const h = document.createElement("div");
    h.textContent = "🏠 " + home;
    h.onclick = () => {
      destinationInput.value = home;
      container.remove();
      planFromInput();
    };
    container.appendChild(h);
  }

  if (work) {
    const w = document.createElement("div");
    w.textContent = "💼 " + work;
    w.onclick = () => {
      destinationInput.value = work;
      container.remove();
      planFromInput();
    };
    container.appendChild(w);
  }

  if (home || work) destinationInput.parentNode.appendChild(container);
});
