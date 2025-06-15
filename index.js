addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const TRIPGO_KEY = "12f16e0e9e72b49e496279d8230b0fec"
const HTML_CONTENT = `...index.html content here...`
const CSS_CONTENT = `...style.css content here...`

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Serve HTML
  if (url.pathname === '/') {
    return new Response(HTML_CONTENT, {
      headers: { 'Content-Type': 'text/html' }
    })
  }
  
  // Serve CSS
  if (url.pathname === '/style.css') {
    return new Response(CSS_CONTENT, {
      headers: { 'Content-Type': 'text/css' }
    })
  }
  
  // API Endpoint for Directions
  if (url.pathname === '/api/directions') {
    const { from, to } = Object.fromEntries(url.searchParams)
    const apiUrl = `https://api.tripgo.com/v1/routing.json?from=${from}&to=${to}&modes=pt_pub&v=11`
    
    const response = await fetch(apiUrl, {
      headers: { 'X-TripGo-Key': TRIPGO_KEY }
    })
    
    if (!response.ok) return new Response('API error', { status: 500 })
    
    const data = await response.json()
    return new Response(JSON.stringify(processTripData(data)), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response('Not found', { status: 404 })
}

function processTripData(data) {
  const trip = data.trips[0]
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
  }))
}

function getInstruction(segment) {
  switch(segment.mode) {
    case 'wa': return `Walk to ${segment.to.name}`
    case 'pt': 
      return `Take ${segment.vehicle?.name || 'transport'} to ${segment.to.name}`
    default: 
      return `Travel to ${segment.to.name}`
  }
}