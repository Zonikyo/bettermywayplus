// index.js - Simplified Canberra Transit App
const TRIPGO_API_KEY = "12f16e0e9e72b49e496279d8230b0fec";

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Serve HTML
  if (url.pathname === '/') {
    return new Response(HTML_CONTENT, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
  
  // Serve CSS
  if (url.pathname === '/style.css') {
    return new Response(CSS_CONTENT, {
      headers: { 'Content-Type': 'text/css' }
    });
  }
  
  // API Endpoints
  if (url.pathname === '/api/directions') {
    const { from, to } = Object.fromEntries(url.searchParams);
    const apiUrl = `https://api.tripgo.com/v1/routing.json?from=${from}&to=${to}&modes=pt_pub&v=11`;
    
    const response = await fetch(apiUrl, {
      headers: { 'X-TripGo-Key': TRIPGO_API_KEY }
    });
    
    if (!response.ok) return new Response('API error', { status: 500 });
    
    const data = await response.json();
    return new Response(JSON.stringify(processTripData(data)), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url.pathname === '/api/autocomplete') {
    const query = url.searchParams.get('q');
    const apiUrl = `https://api.tripgo.com/v1/locations.json?q=${encodeURIComponent(query)}&v=11`;
    
    const response = await fetch(apiUrl, {
      headers: { 'X-TripGo-Key': TRIPGO_API_KEY }
    });
    
    if (!response.ok) return new Response('API error', { status: 500 });
    
    const data = await response.json();
    return new Response(JSON.stringify(data.locations.map(loc => ({
      name: loc.name,
      address: loc.address,
      coords: `${loc.lat},${loc.lng}`
    }))), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Not found', { status: 404 });
}

function processTripData(data) {
  const trip = data.trips[0];
  return {
    summary: {
      duration: Math.round(trip.duration / 60),
      departure: trip.segments[0].startTime,
      arrival: trip.segments[trip.segments.length - 1].endTime,
      cost: trip.fare?.amount ? `$${trip.fare.amount.toFixed(2)}` : null
    },
    segments: trip.segments.map((segment, index) => ({
      order: index + 1,
      mode: segment.mode,
      instruction: getInstruction(segment),
      departure: segment.startTime,
      arrival: segment.endTime,
      from: segment.from.name,
      to: segment.to.name,
      vehicle: segment.vehicle?.name,
      stops: segment.stops?.count,
      realTime: segment.realTime,
      stopsList: segment.stops?.list?.map(stop => stop.name) || []
    }))
  };
}

function getInstruction(segment) {
  switch(segment.mode) {
    case 'wa': return `Walk to ${segment.to.name}`;
    case 'pt': return `Take ${segment.vehicle || 'bus'} to ${segment.to.name}`;
    default: return `Continue to ${segment.to.name}`;
  }
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canberra Transit</title>
  <link rel="stylesheet" href="/style.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
  <div class="app">
    <!-- Home Screen -->
    <div class="screen" id="home-screen">
      <header>
        <h1><i class="fas fa-bus"></i> Canberra Transit</h1>
        <div class="time" id="current-time"></div>
      </header>
      
      <div class="search-box">
        <div class="input-group">
          <i class="fas fa-search"></i>
          <input type="text" id="search-input" placeholder="Search for destination">
        </div>
      </div>
      
      <div class="favorites">
        <h2>Favourites <span>See all</span></h2>
        <div class="favorite-buttons">
          <button class="favorite-btn" id="add-home">
            <i class="fas fa-home"></i> Add Home
          </button>
          <button class="favorite-btn" id="add-work">
            <i class="fas fa-briefcase"></i> Add Work
          </button>
        </div>
      </div>
    </div>
    
    <!-- Search Results Screen -->
    <div class="screen hidden" id="search-screen">
      <header>
        <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
        <h1>Search Results</h1>
      </header>
      
      <div class="search-results" id="search-results"></div>
    </div>
    
    <!-- Directions Screen -->
    <div class="screen hidden" id="directions-screen">
      <header>
        <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
        <h1 id="directions-title"></h1>
      </header>
      
      <div class="trip-summary">
        <div class="time-summary">
          <span id="departure-time"></span> - <span id="arrival-time"></span>
          <span id="duration"></span>
        </div>
        <div class="cost-summary" id="cost"></div>
      </div>
      
      <div class="trip-options">
        <button class="trip-option active">Leave now</button>
        <button class="trip-option">Depart at</button>
        <button class="trip-option">Arrive by</button>
      </div>
      
      <div class="trip-steps" id="trip-steps"></div>
      
      <div class="action-buttons">
        <button class="action-btn"><i class="fas fa-bell"></i> Alert Me</button>
        <button class="action-btn"><i class="fas fa-star"></i> Favorite</button>
        <button class="action-btn primary"><i class="fas fa-play"></i> Go</button>
      </div>
    </div>
    
    <!-- Trip Detail Screen -->
    <div class="screen hidden" id="detail-screen">
      <header>
        <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
        <h1 id="detail-title"></h1>
      </header>
      
      <div class="segment-details">
        <div class="segment-header">
          <div class="transport-icon">
            <i class="fas fa-bus" id="detail-icon"></i>
          </div>
          <div>
            <h2 id="detail-vehicle"></h2>
            <p id="detail-direction"></p>
          </div>
        </div>
        
        <div class="segment-times">
          <div>
            <small>Departs</small>
            <p id="detail-departure"></p>
          </div>
          <div>
            <small>Arrives</small>
            <p id="detail-arrival"></p>
          </div>
        </div>
        
        <div class="stops-list" id="stops-list"></div>
      </div>
    </div>
  </div>
  
  <script>
    // DOM Elements
    const screens = {
      home: document.getElementById('home-screen'),
      search: document.getElementById('search-screen'),
      directions: document.getElementById('directions-screen'),
      detail: document.getElementById('detail-screen')
    };
    
    const currentTimeEl = document.getElementById('current-time');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const backButtons = document.querySelectorAll('.back-btn');
    
    // Current location
    let currentLocation = null;
    
    // Update current time
    function updateTime() {
      const now = new Date();
      currentTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    setInterval(updateTime, 1000);
    updateTime();
    
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        currentLocation = \`\${position.coords.latitude},\${position.coords.longitude}\`;
      });
    }
    
    // Screen navigation
    function showScreen(screen) {
      Object.values(screens).forEach(s => s.classList.add('hidden'));
      screen.classList.remove('hidden');
    }
    
    backButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (screens.detail.classList.contains('hidden')) {
          showScreen(screens.home);
        } else {
          showScreen(screens.directions);
        }
      });
    });
    
    // Search functionality
    searchInput.addEventListener('input', debounce(async (e) => {
      const query = e.target.value.trim();
      if (query.length < 3) return;
      
      showScreen(screens.search);
      searchResults.innerHTML = '<div class="loading">Searching...</div>';
      
      try {
        const response = await fetch(\`/api/autocomplete?q=\${encodeURIComponent(query)}\`);
        const results = await response.json();
        
        searchResults.innerHTML = results.length > 0 
          ? results.map(result => \`
              <div class="result-item" data-coords="\${result.coords}">
                <i class="fas fa-map-marker-alt"></i>
                <div>
                  <h3>\${result.name}</h3>
                  <p>\${result.address || ''}</p>
                </div>
              </div>
            \`).join('')
          : '<div class="no-results">No results found</div>';
          
        // Add click handlers
        document.querySelectorAll('.result-item').forEach(item => {
          item.addEventListener('click', () => {
            if (!currentLocation) {
              alert('Please enable location services');
              return;
            }
            
            getDirections(currentLocation, item.dataset.coords, item.querySelector('h3').textContent);
          });
        });
      } catch (error) {
        searchResults.innerHTML = '<div class="error">Failed to load results</div>';
      }
    }, 300));
    
    // Get directions
    async function getDirections(from, to, destinationName) {
      showScreen(screens.directions);
      document.getElementById('directions-title').textContent = \`To \${destinationName}\`;
      document.getElementById('trip-steps').innerHTML = '<div class="loading">Loading directions...</div>';
      
      try {
        const response = await fetch(\`/api/directions?from=\${encodeURIComponent(from)}&to=\${encodeURIComponent(to)}\`);
        const trip = await response.json();
        
        // Update summary
        document.getElementById('departure-time').textContent = formatTime(trip.summary.departure);
        document.getElementById('arrival-time').textContent = formatTime(trip.summary.arrival);
        document.getElementById('duration').textContent = \`\${trip.summary.duration} min\`;
        if (trip.summary.cost) {
          document.getElementById('cost').textContent = trip.summary.cost;
        }
        
        // Render steps
        document.getElementById('trip-steps').innerHTML = trip.segments.map(segment => \`
          <div class="trip-step" data-index="\${segment.order - 1}">
            <div class="step-number">\${segment.order}</div>
            <div class="step-content">
              <h3>\${segment.instruction}</h3>
              <p>\${formatTime(segment.departure)} - \${formatTime(segment.arrival)}</p>
              \${segment.vehicle ? \`<p class="vehicle"><i class="fas fa-bus"></i> \${segment.vehicle}</p>\` : ''}
            </div>
          </div>
        \`).join('');
        
        // Add click handlers to steps
        document.querySelectorAll('.trip-step').forEach(step => {
          step.addEventListener('click', () => {
            showSegmentDetails(trip.segments[step.dataset.index]);
          });
        });
      } catch (error) {
        document.getElementById('trip-steps').innerHTML = '<div class="error">Failed to load directions</div>';
      }
    }
    
    // Show segment details
    function showSegmentDetails(segment) {
      showScreen(screens.detail);
      document.getElementById('detail-title').textContent = segment.instruction;
      
      if (segment.mode === 'pt') {
        document.getElementById('detail-icon').className = 'fas fa-bus';
        document.getElementById('detail-vehicle').textContent = segment.vehicle || 'Bus';
        document.getElementById('detail-direction').textContent = \`To \${segment.to}\`;
      } else {
        document.getElementById('detail-icon').className = 'fas fa-walking';
        document.getElementById('detail-vehicle').textContent = 'Walking';
        document.getElementById('detail-direction').textContent = \`To \${segment.to}\`;
      }
      
      document.getElementById('detail-departure').textContent = formatTime(segment.departure);
      document.getElementById('detail-arrival').textContent = formatTime(segment.arrival);
      
      const stopsList = document.getElementById('stops-list');
      if (segment.stopsList && segment.stopsList.length > 0) {
        stopsList.innerHTML = \`
          <h3>Stops (\${segment.stopsList.length})</h3>
          \${segment.stopsList.map(stop => \`<div class="stop-item">\${stop}</div>\`).join('')}
        \`;
      } else {
        stopsList.innerHTML = '<div class="no-stops">No stop information available</div>';
      }
    }
    
    // Helper functions
    function formatTime(isoString) {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
    
    // Initialize favorites buttons
    document.getElementById('add-home').addEventListener('click', () => {
      alert('Home location feature coming soon!');
    });
    
    document.getElementById('add-work').addEventListener('click', () => {
      alert('Work location feature coming soon!');
    });
  </script>
</body>
</html>`;

const CSS_CONTENT = `:root {
  --primary: #0047AB;
  --secondary: #FFD700;
  --text: #333;
  --light: #f8f9fa;
  --dark: #343a40;
  --success: #28a745;
  --warning: #ffc107;
  --danger: #dc3545;
  --radius: 8px;
  --shadow: 0 2px 8px rgba(0,0,0,0.1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
  background: #f5f5f5;
  color: var(--text);
  line-height: 1.5;
}

.app {
  max-width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: white;
}

.screen {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.screen.hidden {
  display: none;
}

header {
  padding: 16px;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  gap: 10px;
}

header h1 {
  font-size: 1.2rem;
  font-weight: 600;
  flex: 1;
}

.time {
  font-size: 1rem;
}

.back-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  padding: 0 10px 0 0;
}

.search-box {
  padding: 16px;
}

.input-group {
  display: flex;
  align-items: center;
  background: #f0f2f5;
  border-radius: var(--radius);
  padding: 10px 15px;
}

.input-group i {
  color: #666;
  margin-right: 10px;
}

.input-group input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 1rem;
  outline: none;
}

.favorites {
  padding: 0 16px;
}

.favorites h2 {
  font-size: 1.1rem;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
}

.favorites h2 span {
  font-weight: normal;
  font-size: 0.9rem;
  color: var(--primary);
}

.favorite-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.favorite-btn {
  background: #f0f2f5;
  border: none;
  border-radius: var(--radius);
  padding: 12px;
  text-align: left;
  font-size: 0.9rem;
}

.favorite-btn i {
  margin-right: 8px;
  color: var(--primary);
}

.search-results {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.result-item {
  padding: 12px 0;
  border-bottom: 1px solid #eee;
  display: flex;
  gap: 12px;
}

.result-item i {
  color: var(--primary);
  margin-top: 3px;
}

.result-item h3 {
  font-size: 1rem;
  margin-bottom: 2px;
}

.result-item p {
  font-size: 0.9rem;
  color: #666;
}

.loading, .no-results, .error {
  padding: 20px;
  text-align: center;
  color: #666;
}

.trip-summary {
  padding: 16px;
  background: #f9f9f9;
  border-bottom: 1px solid #eee;
}

.time-summary {
  font-size: 1.1rem;
  margin-bottom: 8px;
}

.time-summary span:last-child {
  color: #666;
  font-size: 0.9rem;
  margin-left: 8px;
}

.cost-summary {
  color: var(--primary);
  font-weight: 500;
}

.trip-options {
  display: flex;
  padding: 10px 16px;
  border-bottom: 1px solid #eee;
}

.trip-option {
  flex: 1;
  background: none;
  border: none;
  padding: 8px;
  font-size: 0.9rem;
}

.trip-option.active {
  font-weight: 600;
  color: var(--primary);
}

.trip-steps {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.trip-step {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f2f5;
}

.step-number {
  width: 24px;
  height: 24px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.step-content h3 {
  font-size: 1rem;
  margin-bottom: 4px;
}

.step-content p {
  font-size: 0.9rem;
  color: #666;
}

.vehicle {
  margin-top: 4px;
  color: var(--primary) !important;
}

.action-buttons {
  display: flex;
  padding: 16px;
  gap: 10px;
  border-top: 1px solid #eee;
}

.action-btn {
  flex: 1;
  background: #f0f2f5;
  border: none;
  border-radius: var(--radius);
  padding: 12px;
  font-size: 0.9rem;
}

.action-btn.primary {
  background: var(--primary);
  color: white;
}

.action-btn i {
  margin-right: 8px;
}

.segment-details {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.segment-header {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.transport-icon {
  width: 40px;
  height: 40px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.segment-header h2 {
  font-size: 1.1rem;
  margin-bottom: 2px;
}

.segment-header p {
  font-size: 0.9rem;
  color: #666;
}

.segment-times {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: var(--radius);
}

.segment-times div {
  text-align: center;
}

.segment-times small {
  display: block;
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 4px;
}

.segment-times p {
  font-size: 1rem;
  font-weight: 500;
}

.stops-list {
  margin-top: 16px;
}

.stops-list h3 {
  font-size: 1rem;
  margin-bottom: 12px;
  color: #666;
}

.stop-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f2f5;
}

.no-stops {
  padding: 20px 0;
  text-align: center;
  color: #666;
}

@media (max-width: 350px) {
  header h1 {
    font-size: 1rem;
  }
  
  .time {
    font-size: 0.9rem;
  }
  
  .favorite-buttons {
    grid-template-columns: 1fr;
  }
}`;