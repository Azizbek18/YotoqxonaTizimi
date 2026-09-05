'use client'

import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import type * as LeafletNS from 'leaflet'
import { Search, LocateFixed, Loader2, X } from 'lucide-react'
import { geocodePlace, type GeocodeResult } from '@/features/dorms/client/api'

// Tashkent centre — the fallback view when the dorm has no coordinate yet.
const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562]

const TILES = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
}

const PIN_HTML = `
<span class="dlp-pin">
  <span class="dlp-pin__pulse"></span>
  <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
    <path d="M12 22s7-6.4 7-12A7 7 0 0 0 5 10c0 5.6 7 12 7 12Z" fill="#4f46e5" stroke="#fff" stroke-width="1.6"/>
    <circle cx="12" cy="10" r="2.6" fill="#fff"/>
  </svg>
</span>`

const near = (a: number | null, b: number | null) =>
  a != null && b != null && Math.abs(a - b) < 1e-6

type Props = {
  isLight: boolean
  lat: number | null
  lng: number | null
  radiusM: number
  onChange: (lat: number, lng: number) => void
}

/**
 * Map-based coordinate picker for the dorm's yo'qlama zone. Search a place or
 * tap the map to drop the pin; the pin is draggable and the allowed-distance
 * circle redraws live as the radius changes. No API key — CARTO/OSM tiles,
 * geocoding proxied through /api/dekan/geocode.
 */
export default function DormLocationPicker({ isLight, lat, lng, radiusM, onChange }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)
  const markerRef = useRef<LeafletNS.Marker | null>(null)
  const circleRef = useRef<LeafletNS.Circle | null>(null)
  const tileRef = useRef<LeafletNS.TileLayer | null>(null)
  const LRef = useRef<typeof LeafletNS | null>(null)
  const echoRef = useRef<{ lat: number; lng: number } | null>(null)

  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)

  const emit = useCallback((la: number, ln: number) => {
    const rla = Math.round(la * 1e6) / 1e6
    const rln = Math.round(ln * 1e6) / 1e6
    echoRef.current = { lat: rla, lng: rln }
    onChange(rla, rln)
  }, [onChange])

  const placePin = useCallback((la: number, ln: number, fly = true) => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return
    const pos = L.latLng(la, ln)
    if (!markerRef.current) {
      markerRef.current = L.marker(pos, {
        draggable: true,
        icon: L.divIcon({ html: PIN_HTML, className: 'dlp-pin-wrap', iconSize: [34, 34], iconAnchor: [17, 32] }),
      }).addTo(map)
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng()
        circleRef.current?.setLatLng(p)
        emit(p.lat, p.lng)
      })
    } else {
      markerRef.current.setLatLng(pos)
    }
    if (!circleRef.current) {
      circleRef.current = L.circle(pos, {
        radius: radiusM,
        color: '#6366f1',
        weight: 1.5,
        fillColor: '#6366f1',
        fillOpacity: 0.12,
      }).addTo(map)
    } else {
      circleRef.current.setLatLng(pos)
    }
    if (fly) map.flyTo(pos, Math.max(map.getZoom(), 16), { duration: 0.6 })
  }, [emit, radiusM])

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mod = await import('leaflet')
      const L = ((mod as { default?: typeof LeafletNS }).default ?? mod) as typeof LeafletNS
      if (cancelled || !boxRef.current || mapRef.current) return
      LRef.current = L
      const map = L.map(boxRef.current, {
        center: lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER,
        zoom: lat != null && lng != null ? 16 : 12,
        zoomControl: true,
        attributionControl: true,
      })
      mapRef.current = map
      const t = isLight ? TILES.light : TILES.dark
      tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 20 }).addTo(map)
      map.on('click', (e: LeafletNS.LeafletMouseEvent) => {
        placePin(e.latlng.lat, e.latlng.lng, false)
        emit(e.latlng.lat, e.latlng.lng)
      })
      if (lat != null && lng != null) placePin(lat, lng, false)
      // The card animates in; Leaflet needs a nudge once its box has size.
      setTimeout(() => map.invalidateSize(), 60)
      setReady(true)
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
      tileRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap tiles on theme change.
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return
    tileRef.current?.remove()
    const t = isLight ? TILES.light : TILES.dark
    tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 20 }).addTo(map)
  }, [isLight])

  // Live radius.
  useEffect(() => {
    if (Number.isFinite(radiusM)) circleRef.current?.setRadius(radiusM)
  }, [radiusM])

  // Coordinates changed from OUTSIDE (manual entry / another dorm) — move the
  // pin. Skip our own echo.
  useEffect(() => {
    if (!ready) return
    if (echoRef.current && near(echoRef.current.lat, lat) && near(echoRef.current.lng, lng)) return
    if (lat != null && lng != null) placePin(lat, lng, true)
  }, [lat, lng, ready, placePin])

  const runSearch = useCallback(async () => {
    const q = query.trim()
    if (q.length < 3) return
    setSearching(true)
    try {
      const { results: r } = await geocodePlace(q)
      setResults(r)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [query])

  const pickResult = (r: GeocodeResult) => {
    setResults([])
    setQuery(r.name.split(',')[0])
    placePin(r.lat, r.lng, true)
    emit(r.lat, r.lng)
  }

  const locateMe = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        placePin(pos.coords.latitude, pos.coords.longitude, true)
        emit(pos.coords.latitude, pos.coords.longitude)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const field = isLight
    ? 'bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400'
    : 'bg-slate-900/90 border-white/10 text-white placeholder:text-slate-500'

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
      <style>{`
        .dlp-pin{position:relative;display:block;width:34px;height:34px}
        .dlp-pin__pulse{position:absolute;left:50%;top:26px;width:10px;height:10px;margin-left:-5px;border-radius:9999px;background:rgba(99,102,241,.45);animation:dlpPulse 1.8s ease-out infinite}
        @keyframes dlpPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(3.2);opacity:0}}
        .dlp-map .leaflet-control-zoom{border:none;box-shadow:0 6px 20px rgba(2,6,23,.18)}
        .dlp-map .leaflet-control-zoom a{border-radius:10px;color:#4f46e5;font-weight:800}
        .dlp-map .leaflet-bar a{background:${isLight ? '#fff' : '#0f172a'};color:${isLight ? '#4f46e5' : '#a5b4fc'};border-color:${isLight ? '#e2e8f0' : 'rgba(255,255,255,.08)'}}
        .dlp-map .leaflet-control-attribution{font-size:9px;background:${isLight ? 'rgba(255,255,255,.7)' : 'rgba(15,23,42,.7)'};color:${isLight ? '#64748b' : '#94a3b8'}}
        .dlp-map .leaflet-control-attribution a{color:inherit}
      `}</style>

      {/* Search bar */}
      <div className="absolute inset-x-3 top-3 z-[500]">
        <div className="flex gap-2">
          <div className={`flex flex-1 items-center gap-2 rounded-xl border px-3 shadow-lg backdrop-blur ${field}`}>
            <Search size={15} className="shrink-0 opacity-60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
              placeholder="Manzil yoki joy nomini qidiring…"
              className="w-full bg-transparent py-2.5 text-xs outline-none"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); setResults([]) }} className="shrink-0 opacity-60 hover:opacity-100">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={runSearch}
            disabled={searching || query.trim().length < 3}
            className="no-shelf shrink-0 rounded-xl bg-indigo-600 px-3.5 text-white shadow-lg transition-colors hover:bg-indigo-700 disabled:opacity-50"
            aria-label="Qidirish"
          >
            {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          </button>
        </div>

        {results.length > 0 && (
          <ul className={`mt-1.5 max-h-44 overflow-y-auto rounded-xl border shadow-xl backdrop-blur ${field}`}>
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lng}-${i}`}>
                <button
                  type="button"
                  onClick={() => pickResult(r)}
                  className={`block w-full px-3 py-2 text-left text-[11px] leading-snug transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'}`}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Locate-me */}
      <button
        type="button"
        onClick={locateMe}
        disabled={locating}
        className={`no-shelf absolute right-3 bottom-9 z-[500] flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur disabled:opacity-50 ${field}`}
        aria-label="Mening joylashuvim"
        title="Mening joylashuvim"
      >
        {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} className="text-indigo-500" />}
      </button>

      {/* Coordinate chip */}
      <div className={`absolute left-3 bottom-9 z-[500] rounded-lg border px-2.5 py-1.5 text-[10px] font-bold tabular-nums shadow-lg backdrop-blur ${field}`}>
        {lat != null && lng != null
          ? `${lat.toFixed(6)}, ${lng.toFixed(6)}`
          : 'Joylashuv tanlanmagan'}
      </div>

      <div ref={boxRef} className="dlp-map h-[340px] w-full" />

      {!ready && (
        <div className={`absolute inset-0 z-[400] flex items-center justify-center text-xs ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-slate-400'}`}>
          <Loader2 size={16} className="mr-2 animate-spin" /> Xarita yuklanmoqda…
        </div>
      )}
    </div>
  )
}
