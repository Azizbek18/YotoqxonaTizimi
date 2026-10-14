'use client'

import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import type * as LeafletNS from 'leaflet'
import { Search, LocateFixed, Loader2, X, MapPin, Layers, Maximize2, Minimize2, Copy, Check, Compass } from 'lucide-react'
import { geocodeAddress, reverseGeocodeAddress, type GeocodeResult } from '@/features/foreign-docs/client/api'

// Tashkent centre — the fallback view before anything is picked.
const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562]

// Uzbekistan regions with centers for one-tap smooth flying.
const UZ_REGIONS = [
  { name: 'Toshkent', lat: 41.311081, lng: 69.240562 },
  { name: 'Samarqand', lat: 39.65417, lng: 66.95972 },
  { name: 'Buxoro', lat: 39.77472, lng: 64.42861 },
  { name: 'Andijon', lat: 40.78206, lng: 72.34424 },
  { name: 'Farg‘ona', lat: 40.38421, lng: 71.78432 },
  { name: 'Namangan', lat: 40.9983, lng: 71.67257 },
  { name: 'Qashqadaryo', lat: 38.86056, lng: 65.78905 },
  { name: 'Surxondaryo', lat: 37.22417, lng: 67.27833 },
  { name: 'Xorazm', lat: 41.55, lng: 60.63333 },
  { name: 'Navoiy', lat: 40.08444, lng: 65.37917 },
  { name: 'Jizzax', lat: 40.11583, lng: 67.84222 },
  { name: 'Sirdaryo', lat: 40.48972, lng: 68.78417 },
  { name: 'Qoraqalpog‘iston', lat: 42.46028, lng: 59.61028 },
] as const

const ESRI_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services'
const ESRI_ATTRIBUTION = '&copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors'
const TILES = {
  light: {
    url: `${ESRI_BASE}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    attribution: '&copy; Esri &mdash; Esri, DeLorme, HERE, USGS, OpenStreetMap contributors',
    maxNativeZoom: 18,
    maxZoom: 19,
  },
  dark: {
    url: `${ESRI_BASE}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    attribution: ESRI_ATTRIBUTION,
    maxNativeZoom: 16,
    maxZoom: 18,
  },
  satellite: {
    url: `${ESRI_BASE}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    attribution: '&copy; Esri &mdash; Maxar, Earthstar Geographics, and the GIS User Community',
    maxNativeZoom: 19,
    maxZoom: 19,
  },
}

const PIN_HTML = `
<div class="amp-pin-root">
  <div class="amp-pin-pulse"></div>
  <div class="amp-pin-body">
    <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
      <defs>
        <linearGradient id="ampPinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#2563eb" />
        </linearGradient>
        <filter id="ampPinShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#0284c7" flood-opacity="0.45"/>
        </filter>
      </defs>
      <path d="M12 22s7.5-6.8 7.5-12.8A7.5 7.5 0 0 0 4.5 9.2C4.5 15.2 12 22 12 22Z" fill="url(#ampPinGrad)" stroke="#ffffff" stroke-width="1.8" filter="url(#ampPinShadow)"/>
      <circle cx="12" cy="9.2" r="3" fill="#ffffff"/>
    </svg>
  </div>
</div>`

type Props = {
  isLight: boolean
  /** Called with the resolved place name every time a pin is dropped, moved, or picked from search. */
  onResolved: (address: string) => void
  /** Optional: the pinned coordinates, reported alongside every `onResolved`. */
  onCoords?: (lat: number, lng: number) => void
  /** Optional initial coordinates to place the pin on mount */
  initialCoords?: { lat: number; lng: number } | null
  /** Optional container height class (defaults to responsive toggleable height) */
  className?: string
  /** Whether to show the province quick-chips bar (default true) */
  showRegions?: boolean
}

export default function AddressMapPicker({
  isLight,
  onResolved,
  onCoords,
  initialCoords,
  className,
  showRegions = true,
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)
  const markerRef = useRef<LeafletNS.Marker | null>(null)
  const tileRef = useRef<LeafletNS.TileLayer | null>(null)
  const LRef = useRef<typeof LeafletNS | null>(null)

  const [ready, setReady] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolvedName, setResolvedName] = useState<string | null>(null)
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(initialCoords ?? null)
  const [copied, setCopied] = useState(false)

  const resolve = useCallback(
    async (la: number, ln: number) => {
      setResolving(true)
      const lat = Math.round(la * 1e6) / 1e6
      const lng = Math.round(ln * 1e6) / 1e6
      setCurrentCoords({ lat, lng })
      onCoords?.(lat, lng)
      try {
        const name = await reverseGeocodeAddress(lat, lng)
        if (name) {
          setResolvedName(name)
          onResolved(name)
        }
      } catch {
        // Best-effort
      } finally {
        setResolving(false)
      }
    },
    [onResolved, onCoords],
  )

  const placePin = useCallback(
    (la: number, ln: number, fly = true, zoomLevel?: number) => {
      const L = LRef.current
      const map = mapRef.current
      if (!L || !map || !Number.isFinite(la) || !Number.isFinite(ln)) return
      const pos = L.latLng(la, ln)
      if (!markerRef.current) {
        markerRef.current = L.marker(pos, {
          draggable: true,
          icon: L.divIcon({
            html: PIN_HTML,
            className: 'amp-pin-container',
            iconSize: [36, 36],
            iconAnchor: [18, 34],
          }),
        }).addTo(map)
        markerRef.current.on('dragend', () => {
          const p = markerRef.current!.getLatLng()
          void resolve(p.lat, p.lng)
        })
      } else {
        markerRef.current.setLatLng(pos)
      }
      if (fly) {
        map.flyTo(pos, zoomLevel ?? Math.max(map.getZoom(), 16), { duration: 0.6 })
      }
    },
    [resolve],
  )

  // Initialize Map
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mod = await import('leaflet')
      const L = ((mod as { default?: typeof LeafletNS }).default ?? mod) as typeof LeafletNS
      if (cancelled || !boxRef.current || mapRef.current) return
      LRef.current = L

      const startCenter = initialCoords ? [initialCoords.lat, initialCoords.lng] as [number, number] : DEFAULT_CENTER
      const map = L.map(boxRef.current, {
        center: startCenter,
        zoom: initialCoords ? 15 : 11,
        zoomControl: false,
        attributionControl: false,
      })
      mapRef.current = map

      const activeTile = satellite ? TILES.satellite : isLight ? TILES.light : TILES.dark
      tileRef.current = L.tileLayer(activeTile.url, {
        attribution: activeTile.attribution,
        maxZoom: activeTile.maxZoom,
        maxNativeZoom: activeTile.maxNativeZoom,
      }).addTo(map)

      // Add minimal sleek zoom control at bottom left
      L.control
        .zoom({
          position: 'bottomleft',
        })
        .addTo(map)

      map.on('click', (e: LeafletNS.LeafletMouseEvent) => {
        placePin(e.latlng.lat, e.latlng.lng, false)
        void resolve(e.latlng.lat, e.latlng.lng)
      })

      if (initialCoords) {
        placePin(initialCoords.lat, initialCoords.lng, false)
      }

      setTimeout(() => map.invalidateSize(), 80)
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

  // Swap tiles when theme or satellite mode toggles
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!ready || !L || !map) return
    tileRef.current?.remove()
    const activeTile = satellite ? TILES.satellite : isLight ? TILES.light : TILES.dark
    tileRef.current = L.tileLayer(activeTile.url, {
      attribution: activeTile.attribution,
      maxZoom: activeTile.maxZoom,
      maxNativeZoom: activeTile.maxNativeZoom,
    }).addTo(map)
  }, [satellite, isLight, ready])

  // Invalidate map size when expanded changes
  useEffect(() => {
    if (!mapRef.current) return
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize()
    }, 220)
    return () => clearTimeout(timer)
  }, [expanded])

  const runSearch = useCallback(async () => {
    const q = query.trim()
    if (q.length < 3) return
    setSearching(true)
    try {
      const { results: r } = await geocodeAddress(q)
      setResults(r || [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [query])

  const pickResult = (r: GeocodeResult) => {
    setResults([])
    setQuery(r.name.split(',')[0])
    placePin(r.lat, r.lng, true, 16)
    setCurrentCoords({ lat: r.lat, lng: r.lng })
    onCoords?.(r.lat, r.lng)
    setResolvedName(r.name)
    onResolved(r.name)
  }

  const locateMe = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        placePin(lat, lng, true, 16)
        void resolve(lat, lng)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const flyToRegion = (lat: number, lng: number) => {
    if (!mapRef.current) return
    mapRef.current.flyTo([lat, lng], 13, { duration: 0.9 })
  }

  const copyCoords = () => {
    if (!currentCoords) return
    navigator.clipboard
      ?.writeText(`${currentCoords.lat.toFixed(6)}, ${currentCoords.lng.toFixed(6)}`)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  const cardBg = isLight ? 'bg-white/95 border-slate-200 text-slate-800' : 'bg-slate-900/90 border-white/10 text-slate-100'

  return (
    <div className="w-full max-w-full min-w-0 space-y-2 overflow-hidden">
      <style>{`
        .amp-pin-root {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          cursor: grab;
        }
        .amp-pin-root:active {
          cursor: grabbing;
        }
        .amp-pin-pulse {
          position: absolute;
          left: 50%;
          top: 28px;
          width: 12px;
          height: 12px;
          margin-left: -6px;
          border-radius: 9999px;
          background: rgba(37, 99, 235, 0.45);
          animation: ampPing 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes ampPing {
          75%, 100% {
            transform: scale(2.8);
            opacity: 0;
          }
        }
        .amp-pin-body {
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .amp-pin-root:hover .amp-pin-body {
          transform: translateY(-3px) scale(1.06);
        }
        .leaflet-bar a {
          background-color: ${isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.88)'} !important;
          color: ${isLight ? '#0284c7' : '#38bdf8'} !important;
          border-color: ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'} !important;
          backdrop-filter: blur(8px);
          border-radius: 8px !important;
          box-shadow: 0 4px 14px rgba(0,0,0,0.1) !important;
          width: 28px !important;
          height: 28px !important;
          line-height: 28px !important;
          font-size: 14px !important;
        }
        .leaflet-bar {
          border: none !important;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
      `}</style>

      {/* Quick Province Navigation Chips */}
      {showRegions && (
        <div className="w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar scroll-smooth">
            <span className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold shrink-0 px-2 py-0.5 sm:py-1 rounded-lg ${isLight ? 'text-slate-500 bg-slate-100' : 'text-slate-400 bg-white/5'}`}>
              <Compass size={11} className="text-sky-500 shrink-0" /> Viloyat:
            </span>
            {UZ_REGIONS.map((reg) => (
              <button
                key={reg.name}
                type="button"
                data-student-button="plain"
                onClick={() => flyToRegion(reg.lat, reg.lng)}
                className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] sm:text-[11px] font-medium transition-all hover:scale-105 active:scale-95 ${
                  isLight
                    ? 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300'
                }`}
              >
                {reg.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map Container */}
      <div
        className={`relative w-full max-w-full min-w-0 overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 ${
          isLight ? 'border-slate-200/90 shadow-slate-200/40' : 'border-white/10 shadow-black/20'
        } ${className || ''}`}
      >
        {/* Floating Top Controls: Search Bar & Map Tools (Fully responsive for 300px) */}
        <div className="absolute inset-x-2 sm:inset-x-3 top-2 sm:top-3 z-[500] flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Search Input Box */}
            <div className={`flex flex-1 min-w-0 items-center gap-1.5 rounded-xl border px-2 sm:px-2.5 py-0.5 sm:py-1 shadow-lg backdrop-blur-md transition-all ${cardBg}`}>
              <Search size={13} className="shrink-0 text-sky-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    runSearch()
                  }
                }}
                placeholder="Qidirish (shahar, ko‘cha)..."
                className="w-full min-w-0 bg-transparent py-1 text-xs outline-none placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  data-student-button="plain"
                  onClick={() => {
                    setQuery('')
                    setResults([])
                  }}
                  className="shrink-0 rounded-full p-0.5 opacity-60 hover:opacity-100"
                  aria-label="Tozalash"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Search Action Button */}
            <button
              type="button"
              data-student-button="plain"
              onClick={runSearch}
              disabled={searching || query.trim().length < 3}
              className="flex h-7.5 w-7.5 sm:h-9 sm:w-auto shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-2 sm:px-3 text-xs font-semibold text-white shadow-md transition-all hover:opacity-95 active:scale-95 disabled:opacity-40"
              title="Qidirish"
            >
              {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            </button>

            {/* Satellite / Street Map Toggle Button */}
            <button
              type="button"
              data-student-button="plain"
              onClick={() => setSatellite(!satellite)}
              className={`flex h-7.5 w-7.5 sm:h-9 sm:w-auto shrink-0 items-center justify-center sm:gap-1.5 rounded-xl border px-2 sm:px-3 text-xs font-medium shadow-md backdrop-blur-md transition-all active:scale-95 ${
                satellite
                  ? 'border-emerald-500/50 bg-emerald-600 text-white shadow-emerald-500/20'
                  : cardBg
              }`}
              title={satellite ? "Oddiy xaritaga o'tish" : "Sun'iy yo'ldosh xaritasiga o'tish"}
            >
              <Layers size={13} className={satellite ? 'text-white' : 'text-sky-500'} />
              <span className="hidden md:inline">{satellite ? 'Gipnoz' : 'Xarita'}</span>
            </button>

            {/* Resize / Expand Toggle */}
            <button
              type="button"
              data-student-button="plain"
              onClick={() => setExpanded(!expanded)}
              className={`flex h-7.5 w-7.5 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl border shadow-md backdrop-blur-md transition-all active:scale-95 ${cardBg}`}
              title={expanded ? 'Kichraytirish' : 'Kattalashtirish'}
            >
              {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>

          {/* Autocomplete Results Dropdown */}
          {results.length > 0 && (
            <div className={`max-h-48 overflow-y-auto rounded-xl border p-1 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150 ${cardBg}`}>
              <div className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Natijalar ({results.length})
              </div>
              <ul className="space-y-0.5">
                {results.map((r, i) => (
                  <li key={`${r.lat}-${r.lng}-${i}`}>
                    <button
                      type="button"
                      data-student-button="plain"
                      onClick={() => pickResult(r)}
                      className={`flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                        isLight ? 'hover:bg-sky-50 text-slate-800' : 'hover:bg-white/10 text-slate-100'
                      }`}
                    >
                      <MapPin size={12} className="mt-0.5 shrink-0 text-sky-500" />
                      <span className="line-clamp-2 text-[11px] leading-tight">{r.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Locate Me Floating Action Button (Bottom Right) */}
        <button
          type="button"
          data-student-button="plain"
          onClick={locateMe}
          disabled={locating}
          className={`absolute bottom-2.5 right-2.5 z-[500] flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border shadow-xl backdrop-blur-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${cardBg}`}
          title="Mening hozirgi joylashuvim"
        >
          {locating ? <Loader2 size={14} className="animate-spin text-sky-500" /> : <LocateFixed size={14} className="text-sky-500" />}
        </button>

        {/* Leaflet Map Box */}
        <div
          ref={boxRef}
          className={`amp-map w-full transition-all duration-300 ${expanded ? 'h-[380px] sm:h-[440px]' : 'h-[240px] sm:h-[270px]'}`}
        />

        {/* Loading Overlay */}
        {!ready && (
          <div
            className={`absolute inset-0 z-[400] flex flex-col items-center justify-center gap-2 text-xs backdrop-blur-sm ${
              isLight ? 'bg-slate-100/90 text-slate-600' : 'bg-slate-950/90 text-slate-300'
            }`}
          >
            <Loader2 size={20} className="animate-spin text-sky-500" />
            <span className="text-[11px]">Xarita yuklanmoqda…</span>
          </div>
        )}
      </div>

      {/* Selected Spot Details Bar */}
      <div
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2.5 rounded-xl border p-2 sm:p-2.5 text-xs transition-all ${
          currentCoords
            ? isLight
              ? 'border-sky-200 bg-sky-50/70 text-slate-800'
              : 'border-sky-500/25 bg-sky-500/10 text-slate-100'
            : isLight
              ? 'border-slate-200 bg-slate-50 text-slate-500'
              : 'border-white/10 bg-white/[0.02] text-slate-400'
        }`}
      >
        <div className="flex min-w-0 w-full sm:w-auto flex-1 items-start gap-1.5 sm:gap-2">
          <div className={`mt-0.5 shrink-0 rounded-md p-1 ${currentCoords ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}>
            <MapPin size={12} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500">
                {currentCoords ? 'Tanlangan nuqta' : 'Joylashuv'}
              </span>
              {resolving && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
                  <Loader2 size={9} className="animate-spin" /> Aniqlanmoqda…
                </span>
              )}
            </div>
            <p className="truncate text-[11px] sm:text-xs font-medium leading-tight">
              {resolvedName || (currentCoords ? `${currentCoords.lat.toFixed(5)}, ${currentCoords.lng.toFixed(5)}` : 'Xaritadan uy ustiga bosing')}
            </p>
          </div>
        </div>

        {currentCoords && (
          <div className="flex w-full sm:w-auto justify-end shrink-0 items-center gap-1.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/50 dark:border-white/5">
            <span className="font-mono text-[10px] sm:text-[10px] opacity-75">
              {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
            </span>
            <button
              type="button"
              data-student-button="plain"
              onClick={copyCoords}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] sm:text-[10px] font-semibold transition-all active:scale-95 ${
                isLight ? 'border-sky-200 bg-white text-sky-700 hover:bg-sky-50' : 'border-sky-500/30 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
              }`}
              title="Koordinatalardan nusxa olish"
            >
              {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
              <span>{copied ? 'Nusxalandi' : 'Nusxa'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
