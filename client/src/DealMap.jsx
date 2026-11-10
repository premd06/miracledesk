import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// a map of where the office's closed deals actually are — one pin per
// closed deal, so you can see at a glance which cities the business
// comes from. same map setup as my real estate site: leaflet with
// esri street tiles. only closed deals get a pin — a pending deal
// isn't firm yet, so it doesn't go on the map.
// the agent dropdown narrows the pins to one agent's deals, so the
// broker can see where each person's business comes from.
// if the server isn't running, it says so plainly instead of showing
// an empty map and leaving you guessing.
function DealMap() {
  const mapDiv = useRef(null)
  const map = useRef(null)
  const [deals, setDeals] = useState([])
  const [agents, setAgents] = useState([])
  const [agentFilter, setAgentFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    apiFetch('/api/deals')
      .then((res) => res.json())
      .then((data) => {
        setDeals(data)
        setLoading(false)
      })
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
    // an agent only sees themselves in this list, the broker sees
    // everyone — the server handles that, the dropdown just shows
    // whatever comes back.
    apiFetch('/api/agents')
      .then((res) => res.json())
      .then((data) => setAgents(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (loading || failed || deals.length === 0 || !mapDiv.current) {
      return undefined
    }

    // centered on the gta, zoomed out enough to see brampton down to
    // mississauga and up to caledon in one view.
    map.current = L.map(mapDiv.current).setView([43.72, -79.72], 10)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Esri' },
    ).addTo(map.current)

    // a plain sage dot with a white ring — the default leaflet pin
    // image breaks under vite, and a dot matches the theme anyway.
    const pin = L.divIcon({
      className: 'deal-pin',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })

    deals
      .filter(
        (deal) =>
          deal.status === 'closed' &&
          deal.lat !== null &&
          deal.lng !== null &&
          (agentFilter === 'all' || deal.agent_id === Number(agentFilter)),
      )
      .forEach((deal) => {
        L.marker([deal.lat, deal.lng], { icon: pin })
          .addTo(map.current)
          .bindPopup(
            `<strong>${deal.address}</strong><br>` +
              `${deal.agent_name} — ${deal.side}<br>` +
              `Net: $${deal.net.toLocaleString()}`,
          )
      })

    const mapInstance = map.current
    return () => {
      mapInstance.remove()
      map.current = null
    }
  }, [deals, loading, failed, agentFilter])

  if (loading) {
    return <p className="table-note">Loading map…</p>
  }

  if (failed) {
    return (
      <p className="table-note">
        Couldn&apos;t reach the server — make sure it&apos;s running, then
        refresh this page.
      </p>
    )
  }

  const closedCount = deals.filter(
    (deal) =>
      deal.status === 'closed' &&
      deal.lat !== null &&
      deal.lng !== null &&
      (agentFilter === 'all' || deal.agent_id === Number(agentFilter)),
  ).length

  if (closedCount === 0) {
    return (
      <>
        <div className="table-filters">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            aria-label="Filter pins by agent"
          >
            <option value="all">All agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <p className="table-note">
          No closed deals to show for that agent yet.
        </p>
      </>
    )
  }

  return (
    <>
      <div className="table-filters">
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          aria-label="Filter pins by agent"
        >
          <option value="all">All agents</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>
      <p className="table-note">
        {closedCount} closed {closedCount === 1 ? 'deal' : 'deals'} on the
        map — click a pin for the address and net.
      </p>
      <div ref={mapDiv} className="deal-map" />
    </>
  )
}

export default DealMap
