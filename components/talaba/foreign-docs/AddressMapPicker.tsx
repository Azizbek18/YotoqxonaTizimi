'use client'

import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import type * as LeafletNS from 'leaflet'
import { Search, LocateFixed, Loader2, X, MapPin } from 'lucide-react'
import { geocodeAddress, reverseGeocodeAddress, type GeocodeResult } from '@/features/foreign-docs/client/api'

// Tashkent centre — the fallback view before anything is picked.
const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562]

// CARTO's anonymous (no-key) raster basemaps stopped serving real tiles —
// every style now returns a watermarked "API KEY REQUIRED" placeholder.
// Plain tile.openstreetmap.org also doesn't work as a drop-in replacement —
// OSM's tile usage policy actively blocks embedded apps ("Access blocked...
// not following the tile usage policy", see osm.wiki/Blocked). Esri's free
// "Canvas" world basemaps (no API key, embeddable) have genuine light AND
// dark styles. Kept in sync with the same fix in
// components/dekan/DormLocationPicker.tsx.
const ESRI_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'
const ESRI_ATTRIBUTION = '&copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors'
const TILES = {
  light: { url: `${ESRI_BASE}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, attribution: ESRI_ATTRIBUTION },
  dark: { url: `${ESRI_BASE}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, attribution: ESRI_ATTRIBUTION },
}

const PIN_HTML = `
<span class="amp-pin">
  <span class="amp-pin__pulse"></span>
  <svg viewBox="0 0 24 24" width="34" height="34" fill="none">
    <path d="M12 22s7-6.4 7-12A7 7 0 0 0 5 10c0 5.6 7 12 7 12Z" fill="#0ea5e9" stroke="#fff" stroke-width="1.6"/>
    <circle cx="12" cy="10" r="2.6" fill="#fff"/>
  </svg>
</span>`

type Props = {
  isLight: boolean
  /** Called with the resolved place name every time a pin is dropped, moved, or picked from search. */
  onResolved: (address: string) => void
}

/**
 * Map-based address picker for propiska (ForeignDocModal, docType
 * 'registration'). Search a place or tap/drag the pin; every placement
 * reverse-geocodes the coordinates and hands the resolved name up via
 * `onResolved` — the caller pours that into its own editable address
 * textarea, so the field stays both typeable AND map-fillable (2026-09-15
 * user request). No API key — Esri Canvas tiles, geocoding proxied through
 * /api/student/geocode. Trimmed twin of components/dekan/DormLocationPicker
 * (no check-in radius circle here).
 */
export default function AddressMapPicker({ isLight, onResolved }: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)
  const markerRef = useRef<LeafletNS.Marker | null>(null)
  const tileRef = useRef<LeafletNS.TileLayer | null>(null)
  const LRef = useRef<typeof LeafletNS | null>(null)

  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolvedName, setResolvedName] = useState<string | null>(null)

  const resolve = useCallback(async (la: number, ln: number) => {
    setResolving(true)
    try {
      const name = await reverseGeocodeAddress(la, ln)
      if (name) {
        setResolvedName(name)
        onResolved(name)
      }
    } catch {
      // Best-effort — the pin still dropped, the student can type the
      // address by hand if reverse lookup fails.
    } finally {
      setResolving(false)
    }
  }, [onResolved])

  const placePin = useCallback((la: number, ln: number, fly = true) => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return
    const pos = L.latLng(la, ln)
    if (!markerRef.current) {
      markerRef.current = L.marker(pos, {
        draggable: true,
        icon: L.divIcon({ html: PIN_HTML, className: 'amp-pin-wrap', iconSize: [34, 34], iconAnchor: [17, 32] }),
      }).addTo(map)
      markerRef.current.on('dragend', () => {
        const p = markerRef.current!.getLatLng()
        void resolve(p.lat, p.lng)
      })
    } else {
      markerRef.current.setLatLng(pos)
    }
    if (fly) map.flyTo(pos, Math.max(map.getZoom(), 16), { duration: 0.6 })
  }, [resolve])

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mod = await import('leaflet')
      const L = ((mod as { default?: typeof LeafletNS }).default ?? mod) as typeof LeafletNS
      if (cancelled || !boxRef.current || mapRef.current) return
      LRef.current = L
      const map = L.map(boxRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
      })
      mapRef.current = map
      const t = isLight ? TILES.light : TILES.dark
      tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 18 }).addTo(map)
      map.on('click', (e: LeafletNS.LeafletMouseEvent) => {
        placePin(e.latlng.lat, e.latlng.lng, false)
        void resolve(e.latlng.lat, e.latlng.lng)
      })
      setTimeout(() => map.invalidateSize(), 60)
      setReady(true)
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markerRef.current = null
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
    tileRef.current = L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 18 }).addTo(map)
  }, [isLight])

  const runSearch = useCallback(async () => {
    const q = query.trim()
    if (q.length < 3) return
    setSearching(true)
    try {
      const { results: r } = await geocodeAddress(q)
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
    setResolvedName(r.name)
    onResolved(r.name)
  }

  const locateMe = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        placePin(pos.coords.latitude, pos.coords.longitude, true)
        void resolve(pos.coords.latitude, pos.coords.longitude)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const field = isLight
    ? 'bg-white/95 border-slate-200 text-slate-900 placeholder:text-slate-400'
    : 'bg-slate-900/90 border-white/10 text-white placeholder:text-slate-500'

  return (
    <div>
      <div className={`relative overflow-hidden rounded-2xl border ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
        <style>{`
          .amp-pin{position:relative;display:block;width:34px;height:34px}
          .amp-pin__pulse{position:absolute;left:50%;top:26px;width:10px;height:10px;margin-left:-5px;border-radius:9999px;background:rgba(14,165,233,.45);animation:ampPulse 1.8s ease-out infinite}
          @keyframes ampPulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(3.2);opacity:0}}
          .amp-map .leaflet-control-zoom{border:none;box-shadow:0 6px 20px rgba(2,6,23,.18)}
          .amp-map .leaflet-control-zoom a{border-radius:10px;color:#0ea5e9;font-weight:800}
          .amp-map .leaflet-bar a{background:${isLight ? '#fff' : '#0f172a'};color:${isLight ? '#0ea5e9' : '#7dd3fc'};border-color:${isLight ? '#e2e8f0' : 'rgba(255,255,255,.08)'}}
          .amp-map .leaflet-control-attribution{font-size:9px;background:${isLight ? 'rgba(255,255,255,.7)' : 'rgba(15,23,42,.7)'};color:${isLight ? '#64748b' : '#94a3b8'}}
          .amp-map .leaflet-control-attribution a{color:inherit}
        `}</style>

        {/* Search bar */}
        <div className="absolute inset-x-3 top-3 z-[500]">
          <div className="flex gap-2">
            <div className={`flex flex-1 items-center gap-2 rounded-xl border px-3 shadow-lg backdrop-blur ${field}`}>
              <Search size={15} className="shrink-0 opacity-60" />
              <input
                type="text"
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
              className="shrink-0 rounded-xl bg-sky-600 px-3.5 text-white shadow-lg transition-colors hover:bg-sky-700 disabled:opacity-50"
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
          className={`absolute right-3 bottom-3 z-[500] flex h-10 w-10 items-center justify-center rounded-xl border shadow-lg backdrop-blur disabled:opacity-50 ${field}`}
          aria-label="Mening joylashuvim"
          title="Mening joylashuvim"
        >
          {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} className="text-sky-500" />}
        </button>

        <div ref={boxRef} className="amp-map h-[220px] w-full" />

        {!ready && (
          <div className={`absolute inset-0 z-[400] flex items-center justify-center text-xs ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-slate-400'}`}>
            <Loader2 size={16} className="mr-2 animate-spin" /> Xarita yuklanmoqda…
          </div>
        )}
      </div>

      {/* Auto-filled name of the pinned spot — the "pastda avtomatik chiqadi" bit. */}
      <div className={`mt-2 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-snug ${
        isLight ? 'border-sky-200 bg-sky-50 text-slate-700' : 'border-sky-500/20 bg-sky-500/5 text-slate-300'
      }`}>
        <MapPin size={13} className="mt-0.5 shrink-0 text-sky-500" />
        {resolving ? (
          <span className="flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" /> Manzil aniqlanmoqda…
          </span>
        ) : resolvedName ? (
          <span>{resolvedName}</span>
        ) : (
          <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>
            Xaritadan joy tanlang — manzil shu yerda avtomatik chiqadi
          </span>
        )}
      </div>
    </div>
  )
}
