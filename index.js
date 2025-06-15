// index.js - Cloudflare Worker handling both frontend and backend
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

// Embedded HTML Content
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
        <input type="text" id="end" placeholder="Where to?">
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

    // Get directions
    searchBtn.addEventListener('click', async () => {
      if (!startInput.value || !endInput.value) {
        showError("Please enter start and end locations");
        return;
      }
      
      try {
        showLoading(true);
        directionsEl.innerHTML = '';
        
        const response = await fetch(
          \`/api/directions?from=\${encodeURIComponent(startInput.value)}&to=\${encodeURIComponent(endInput.value)}\`
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
      
      segments.forEach(segment => {
        html += \`
          <div class="step">
            <div class="step-header">
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
  </script>
</body>
</html>`;

// Embedded CSS Content
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
}

.input-group {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  background: var(--light);
  border-radius: var(--radius);
  padding: 0.8rem;
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

@media (max-width: 480px) {
  .step-header {
    flex-direction: column;
  }
  
  .step-details {
    padding-left: 0;
    margin-top: 1rem;
  }
}`;