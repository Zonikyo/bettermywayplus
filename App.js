const API_KEY = '12f16e0e9e72b49e496279d8230b0fec';
const REGION = 'au'; // Using Australia
let userCoords = null;

// Leaflet Map Setup
const map = L.map('map-container').setView([-35.2809, 149.1300], 14); // Default to Canberra
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Location Marker
let userMarker = null;

navigator.geolocation.getCurrentPosition(async (pos) => {
  userCoords = [pos.coords.latitude, pos.coords.longitude];
  map.setView(userCoords, 15);
  userMarker = L.marker(userCoords).addTo(map).bindPopup('You are here').openPopup();
  await loadNearbyStops(userCoords);
}, () => {
  alert("Location access denied. App may not work properly.");
});

// DOM Elements
const input = document.getElementById("destination-input");
const planBtn = document.getElementById("plan-btn");
const tripScreen = document.getElementById("trip-screen");
const tripList = document.getElementById("trip-options");

// Debounced Suggestion Fetcher
let debounceTimeout;
input.addEventListener("input", (e) => {
  const query = e.target.value.trim();
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    if (query.length >= 2) fetchSuggestions(query);
  }, 300);
});

// Search and Plan Button
planBtn.addEventListener("click", () => {
  const dest = input.value;
  if (!dest || !userCoords) return;
  planTrip(dest);
});

// Fetch Suggestions
async function fetchSuggestions(query) {
  const url = `https://tripgo.skedgo.com/v1/locations?term=${encodeURIComponent(query)}&region=${REGION}`;
  const res = await fetch(url, {
    headers: { 'Authorization': API_KEY }
  });
  const data = await res.json();
  showAutoComplete(data);
}

function showAutoComplete(locations) {
  // Simple dropdown (can be replaced with a proper dropdown plugin)
  let dropdown = document.getElementById("autocomplete");
  if (dropdown) dropdown.remove();

  dropdown = document.createElement("div");
  dropdown.id = "autocomplete";
  dropdown.style.position = "absolute";
  dropdown.style.background = "#1e1e1e";
  dropdown.style.borderRadius = "10px";
  dropdown.style.top = input.getBoundingClientRect().bottom + "px";
  dropdown.style.left = input.getBoundingClientRect().left + "px";
  dropdown.style.width = input.offsetWidth + "px";
  dropdown.style.zIndex = 1000;
  dropdown.style.color = "#fff";

  locations.forEach(loc => {
    const option = document.createElement("div");
    option.innerText = loc.name;
    option.style.padding = "0.5rem";
    option.style.cursor = "pointer";
    option.addEventListener("click", () => {
      input.value = loc.name;
      dropdown.remove();
      planTrip(loc);
    });
    dropdown.appendChild(option);
  });

  document.body.appendChild(dropdown);
}

// Plan Trip
async function planTrip(destination) {
  const origin = { lat: userCoords[0], lon: userCoords[1] };
  const destinationLocation = typeof destination === 'string'
    ? await resolveAddress(destination)
    : { lat: destination.lat, lon: destination.lon };

  const url = `https://tripgo.skedgo.com/v1/routing.json?fromLat=${origin.lat}&fromLon=${origin.lon}&toLat=${destinationLocation.lat}&toLon=${destinationLocation.lon}&region=${REGION}`;
  const res = await fetch(url, {
    headers: { 'Authorization': API_KEY }
  });
  const data = await res.json();
  displayTrips(data);
}

// Display Trip Options
function displayTrips(tripData) {
  tripScreen.classList.remove("hidden");
  tripList.innerHTML = '';

  if (!tripData.itineraries || tripData.itineraries.length === 0) {
    tripList.innerHTML = "<li>No routes found.</li>";
    return;
  }

  tripData.itineraries.forEach((itinerary) => {
    const li = document.createElement("li");
    const summary = itinerary.legs.map(l => l.transportation.mode).join(" → ");
    li.innerHTML = `<strong>${summary}</strong><br>${itinerary.legs.length} steps - ${(itinerary.duration / 60).toFixed(0)} mins`;
    tripList.appendChild(li);
  });
}

// Close trip screen
function closeTripScreen() {
  tripScreen.classList.add("hidden");
}

// Resolve string address to lat/lon
async function resolveAddress(address) {
  const url = `https://tripgo.skedgo.com/v1/locations?term=${encodeURIComponent(address)}&region=${REGION}`;
  const res = await fetch(url, {
    headers: { 'Authorization': API_KEY }
  });
  const data = await res.json();
  if (!data[0]) throw new Error("Destination not found.");
  return { lat: data[0].lat, lon: data[0].lon };
}

// Show nearby stops on the map
async function loadNearbyStops(coords) {
  const [lat, lon] = coords;
  const url = `https://tripgo.skedgo.com/v1/locations/nearby?lat=${lat}&lon=${lon}&types=stop`;
  const res = await fetch(url, {
    headers: { 'Authorization': API_KEY }
  });
  const stops = await res.json();
  stops.forEach(stop => {
    L.circleMarker([stop.lat, stop.lon], {
      color: '#00c853',
      radius: 5
    }).addTo(map).bindPopup(stop.name);
  });
}
