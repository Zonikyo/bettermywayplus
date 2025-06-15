// index.js - Cloudflare Worker with Autocomplete Feature
const TRIPGO_API_KEY = "12f16e0e9e72b49e496279d8230b0fec";

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Serve HTML frontend
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
  
  // API Endpoint for Directions
  if (url.pathname === '/api/directions') {
    const { from, to } = Object.fromEntries(url.searchParams);
    const apiUrl = `https://api.tripgo.com/v1/routing.json?from=${from}&to=${to}&modes=pt_pub&v=11`;
    
    const response = await fetch(apiUrl, {
      headers: { 'X-TripGo-Key': TRIPGO_API_KEY }
    });
    
    if (!response.ok) return new Response('API error', { status: 500 });
    
    const data = await response.json();
    return new Response(JSON.stringify(processTripData(data)), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=30'
      }
    });
  }
  
  // Autocomplete API Endpoint
  if (url.pathname === '/api/autocomplete') {
    const query = url.searchParams.get('q');
    const apiUrl = `https://api.tripgo.com/v1/locations.json?q=${encodeURIComponent(query)}&v=11`;
    
    const response = await fetch(apiUrl, {
      headers: { 'X-TripGo-Key': TRIPGO_API_KEY }
    });
    
    if (!response.ok) return new Response('Autocomplete error', { status: 500 });
    
    const data = await response.json();
    const suggestions = data.locations.map(loc => ({
      name: loc.name,
      coords: `${loc.lat},${loc.lng}`
    }));
    
    return new Response(JSON.stringify(suggestions), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=3600'
      }
    });
  }
  
  return new Response('Not found', { status: 404 });
}

function processTripData(data) {
  const trip = data.trips[0];
  return trip.segments.map(segment => ({
    mode: segment.mode,
    instruction: getInstruction(segment),
    from: segment.from.name,
    to: segment.to.name,
    startTime: segment.startTime,
    endTime: segment.endTime,
    realTime: segment.realTime,
    occupancy: segment.service?.occupancy?.level,
    vehicle: segment.vehicle?.name,
    stops: segment.stops?.count,
    geometry: segment.geometry
  }));
}

function getInstruction(segment) {
  switch(segment.mode) {
    case 'wa': return `Walk to ${segment.to.name}`;
    case 'pt': 
      return `Take ${segment.vehicle?.name || 'transport'} to ${segment.to.name}`;
    default: 
      return `Travel to ${segment.to.name}`;
  }
}

// Embedded HTML Content with Autocomplete Feature
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
  <div class="container">
    <header>
      <h1><i class="fas fa-bus"></i> Canberra Transit</h1>
    </header>
    
    <div class="search-box">
      <div class="input-group">
        <i class="fas fa-location-dot"></i>
        <input type="text" id="start" placeholder="Current location" readonly>
        <button id="locate"><i class="fas fa-location-crosshairs"></i></button>
      </div>
      
      <div class="input-group">
        <i class="fas fa-flag"></i>
        <input type="text" id="end" placeholder="Where to?" autocomplete="off">
        <div id="autocomplete-results" class="autocomplete-results"></div>
      </div>
      
      <button id="search-btn">Get Directions</button>
    </div>
    
    <div class="results">
      <div id="loading" class="hidden">
        <div class="loader"></div>
        <p>Finding best routes...</p>
      </div>
      <div id="error" class="hidden"></div>
      <div id="directions"></div>
    </div>
  </div>
  
  <script>
    // DOM Elements
    const startInput = document.getElementById('start');
    const endInput = document.getElementById('end');
    const locateBtn = document.getElementById('locate');
    const searchBtn = document.getElementById('search-btn');
    const directionsEl = document.getElementById('directions');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const autocompleteResults = document.getElementById('autocomplete-results');
    
    // Store selected destination
    let selectedDestination = null;

    // Get user location
    locateBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showError("Geolocation not supported");
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        position => {
          startInput.value = \`\${position.coords.latitude},\${position.coords.longitude}\`;
        },
        error => {
          showError(\`Location error: \${error.message}\`);
        }
      );
    });

    // Autocomplete functionality
    endInput.addEventListener('input', debounce(async () => {
      const query = endInput.value.trim();
      
      if (query.length < 3) {
        autocompleteResults.innerHTML = '';
        autocompleteResults.classList.remove('visible');
        return;
      }
      
      try {
        const response = await fetch(\`/api/autocomplete?q=\${encodeURIComponent(query)}\`);
        
        if (!response.ok) throw new Error('Failed to fetch suggestions');
        
        const suggestions = await response.json();
        renderAutocomplete(suggestions);
      } catch (error) {
        console.error('Autocomplete error:', error);
        autocompleteResults.innerHTML = '';
      }
    }, 300));

    function renderAutocomplete(suggestions) {
      if (suggestions.length === 0) {
        autocompleteResults.innerHTML = '<div class="autocomplete-item">No results found</div>';
        autocompleteResults.classList.add('visible');
        return;
      }
      
      autocompleteResults.innerHTML = suggestions.map(suggestion => \`
        <div class="autocomplete-item" data-coords="\${suggestion.coords}">
          <i class="fas fa-map-marker-alt"></i>
          \${suggestion.name}
        </div>
      \`).join('');
      
      autocompleteResults.classList.add('visible');
      
      // Add click handlers
      document.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          selectedDestination = {
            name: item.textContent.trim(),
            coords: item.dataset.coords
          };
          endInput.value = selectedDestination.name;
          autocompleteResults.innerHTML = '';
          autocompleteResults.classList.remove('visible');
        });
      });
    }

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.input-group')) {
        autocompleteResults.classList.remove('visible');
      }
    });

    // Get directions
    searchBtn.addEventListener('click', async () => {
      if (!startInput.value) {
        showError("Please enable location access");
        return;
      }
      
      if (!selectedDestination) {
        showError("Please select a destination from the suggestions");
        return;
      }
      
      try {
        showLoading(true);
        directionsEl.innerHTML = '';
        
        const response = await fetch(
          \`/api/directions?from=\${encodeURIComponent(startInput.value)}&to=\${encodeURIComponent(selectedDestination.coords)}\`
        );
        
        if (!response.ok) throw new Error('Failed to get directions');
        
        const segments = await response.json();
        renderDirections(segments);
      } catch (error) {
        showError(error.message);
      } finally {
        showLoading(false);
      }
    });

    // Render directions
    function renderDirections(segments) {
      let html = '<div class="steps">';
      
      segments.forEach((segment, index) => {
        html += \`
          <div class="step">
            <div class="step-header">
              <div class="step-number">\${index + 1}</div>
              <div class="mode-icon \${segment.mode}">
                \${getModeIcon(segment.mode)}
              </div>
              <div>
                <h3>\${segment.instruction}</h3>
                <p>\${formatTime(segment.startTime)} → \${formatTime(segment.endTime)}</p>
              </div>
            </div>
            
            <div class="step-details">
              <p><i class="fas fa-map-pin"></i> \${segment.from} → \${segment.to}</p>
              \${segment.vehicle ? \`<p><i class="fas fa-bus"></i> \${segment.vehicle}</p>\` : ''}
              \${segment.stops ? \`<p><i class="fas fa-road"></i> \${segment.stops} stops</p>\` : ''}
              \${segment.occupancy ? \`<p><i class="fas fa-users"></i> Crowding: \${getCrowdingIcon(segment.occupancy)}</p>\` : ''}
              \${segment.realTime ? '<p class="realtime"><i class="fas fa-circle-dot"></i> Live tracking</p>' : ''}
            </div>
          </div>
        \`;
      });
      
      html += '</div>';
      directionsEl.innerHTML = html;
    }

    // Helper functions
    function getModeIcon(mode) {
      const icons = {
        'wa': '<i class="fas fa-person-walking"></i>',
        'pt': '<i class="fas fa-bus"></i>',
        'rail': '<i class="fas fa-train"></i>'
      };
      return icons[mode] || '<i class="fas fa-route"></i>';
    }
    
    function getCrowdingIcon(level) {
      const levels = {
        'low': '<span class="low">Low <i class="fas fa-circle"></i></span>',
        'medium': '<span class="medium">Medium <i class="fas fa-circle"></i></span>',
        'high': '<span class="high">High <i class="fas fa-circle"></i></span>'
      };
      return levels[level] || level;
    }
    
    function formatTime(isoString) {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    function showLoading(show) {
      loadingEl.classList.toggle('hidden', !show);
    }
    
    function showError(message) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
      setTimeout(() => errorEl.classList.add('hidden'), 5000);
    }
    
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
  </script>
</body>
</html>`;

// Embedded CSS Content with Autocomplete Styles
const CSS_CONTENT = `:root {
  --primary: #0047AB;
  --secondary: #FFD700;
  --text: #333;
  --light: #f8f9fa;
  --dark: #343a40;
  --success: #28a745;
  --warning: #ffc107;
  --danger: #dc3545;
  --radius: 12px;
  --shadow: 0 4px 12px rgba(0,0,0,0.1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

body {
  background: #f0f2f5;
  color: var(--text);
  line-height: 1.6;
}

.container {
  max-width: 100%;
  padding: 0;
}

header {
  background: var(--primary);
  color: white;
  padding: 1rem;
  text-align: center;
  box-shadow: var(--shadow);
}

h1 {
  font-size: 1.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.search-box {
  padding: 1.5rem;
  background: white;
  border-radius: 0 0 var(--radius) var(--radius);
  box-shadow: var(--shadow);
  position: relative;
}

.input-group {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  background: var(--light);
  border-radius: var(--radius);
  padding: 0.8rem;
  position: relative;
}

.input-group i {
  font-size: 1.2rem;
  color: var(--primary);
  margin-right: 10px;
}

input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 1rem;
  padding: 0.5rem 0;
  outline: none;
}

button {
  background: var(--primary);
  color: white;
  border: none;
  padding: 1rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: var(--radius);
  cursor: pointer;
  width: 100%;
  transition: all 0.3s ease;
}

#locate {
  background: transparent;
  color: var(--primary);
  width: auto;
  padding: 0.5rem;
  font-size: 1.2rem;
}

#search-btn {
  background: var(--secondary);
  color: var(--dark);
  margin-top: 1rem;
}

#search-btn:hover {
  background: #e6c200;
}

.results {
  padding: 1.5rem;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.step {
  background: white;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.5rem;
  position: relative;
  overflow: hidden;
}

.step:before {
  content: "";
  position: absolute;
  left: 28px;
  top: 55px;
  bottom: 0;
  width: 2px;
  background: #e0e0e0;
  z-index: 1;
}

.step:last-child:before {
  display: none;
}

.step-header {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  position: relative;
  z-index: 2;
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
  font-weight: bold;
  font-size: 0.9rem;
  position: absolute;
  left: -40px;
  top: 12px;
}

.mode-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.step-header h3 {
  font-size: 1.1rem;
  margin-bottom: 0.3rem;
}

.step-header p {
  color: #666;
  font-size: 0.9rem;
}

.step-details {
  padding-left: 64px;
}

.step-details p {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.realtime {
  color: var(--success);
  font-weight: 600;
}

.low { color: var(--success); }
.medium { color: var(--warning); }
.high { color: var(--danger); }

.hidden { display: none; }

#loading {
  text-align: center;
  padding: 2rem;
}

.loader {
  border: 4px solid rgba(0,71,171,0.2);
  border-top: 4px solid var(--primary);
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Autocomplete styles */
.autocomplete-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border-radius: 0 0 var(--radius) var(--radius);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  display: none;
}

.autocomplete-results.visible {
  display: block;
}

.autocomplete-item {
  padding: 0.8rem 1rem;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #eee;
}

.autocomplete-item:hover {
  background-color: #f0f2f5;
}

.autocomplete-item i {
  color: var(--primary);
}

@media (max-width: 480px) {
  .step-header {
    flex-direction: column;
  }
  
  .step-details {
    padding-left: 0;
    margin-top: 1rem;
  }
  
  .step-number {
    position: relative;
    left: 0;
    top: 0;
    margin-bottom: 0.5rem;
  }
}`;