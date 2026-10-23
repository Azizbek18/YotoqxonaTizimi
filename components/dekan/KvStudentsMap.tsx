'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type * as LeafletNS from 'leaflet'
import { Loader2, MapPin } from 'lucide-react'
import { dekanUI } from '@/lib/dekan-ui'

export type KvMapStudent = {
  id: string
  full_name: string
  residence_address?: string | null
  residence_lat?: number | null
  residence_lng?: number | null
}

const DEFAULT_CENTER: [number, number] = [41.311081, 69.240562]
/** A lone student is shown at district level, not street level (nothing around it to read). */
const SINGLE_POINT_ZOOM = 13
// Same light street map as the student's own address picker; the gray "Canvas" base had no
// street names and read as an empty grey sheet. Both hosts are already in the img-src CSP.
const TILES = {
  light: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, DeLorme, HERE, USGS, OpenStreetMap contributors',
    maxNativeZoom: 18,
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    maxNativeZoom: 19,
  },
} as const

const escapeHtml = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** KV-talabalar yashash joylari xaritasi (faqat koordinatasi bor talabalar). */
export default function KvStudentsMap({
  students,
  isLight,
  onOpen,
}: {
  students: KvMapStudent[]
  isLight: boolean
  onOpen?: (id: string) => void
}) {
  const ui = dekanUI(isLight)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletNS.Map | null>(null)
  const layerRef = useRef<LeafletNS.LayerGroup | null>(null)
  const tileRef = useRef<LeafletNS.TileLayer | null>(null)
  const LRef = useRef<typeof LeafletNS | null>(null)
  const [ready, setReady] = useState(false)

  const located = students.filter(
    (s) => typeof s.residence_lat === 'number' && typeof s.residence_lng === 'number',
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mod = await import('leaflet')
      const L = ((mod as { default?: typeof LeafletNS }).default ?? mod) as typeof LeafletNS
      if (cancelled || !boxRef.current || mapRef.current) return
      LRef.current = L
      const map = L.map(boxRef.current, { center: DEFAULT_CENTER, zoom: 11, attributionControl: true })
      mapRef.current = map
      layerRef.current = L.layerGroup().addTo(map)
      setTimeout(() => map.invalidateSize(), 60)
      setReady(true)
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      layerRef.current = null
      tileRef.current = null
    }
  }, [])

  // Tile style follows the theme.
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    if (!ready || !L || !map) return
    tileRef.current?.remove()
    const tile = isLight ? TILES.light : TILES.dark
    tileRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
      maxZoom: 18,
      maxNativeZoom: tile.maxNativeZoom,
    }).addTo(map)
  }, [ready, isLight])

  // Markers follow the (filtered) student list.
  useEffect(() => {
    const L = LRef.current
    const map = mapRef.current
    const layer = layerRef.current
    if (!ready || !L || !map || !layer) return
    layer.clearLayers()
    const points: LeafletNS.LatLngExpression[] = []
    for (const s of located) {
      const pos: LeafletNS.LatLngExpression = [s.residence_lat!, s.residence_lng!]
      points.push(pos)
      // Soft halo under the dot so it stays visible on a busy street map.
      L.circleMarker(pos, {
        radius: 16,
        stroke: false,
        fillColor: '#6366f1',
        fillOpacity: 0.18,
        interactive: false,
      }).addTo(layer)
      const marker = L.circleMarker(pos, {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#4f46e5',
        fillOpacity: 1,
      }).addTo(layer)
      marker.bindTooltip(escapeHtml(s.full_name), { direction: 'top', offset: [0, -10] })
      marker.bindPopup(
        `<strong>${escapeHtml(s.full_name)}</strong><br/><span style="font-size:11px">${escapeHtml(s.residence_address ?? '')}</span>`,
      )
      if (onOpen) marker.on('dblclick', () => onOpen(s.id))
    }
    if (points.length === 1) map.setView(points[0], SINGLE_POINT_ZOOM)
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, students])

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border ${ui.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
        <h3 className={`flex items-center gap-2 text-sm font-bold ${ui.strong}`}>
          <MapPin size={15} className="text-indigo-500" /> Yashash joylari xaritasi
        </h3>
        <span className={`text-[11px] ${ui.muted}`}>
          {located.length} / {students.length} ta talaba xaritada
        </span>
      </div>
      <div className="relative flex-1">
        <div ref={boxRef} className="h-full min-h-[280px] w-full sm:min-h-[320px]" />
        {!ready && (
          <div className={`absolute inset-0 z-[400] flex items-center justify-center text-xs ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-slate-400'}`}>
            <Loader2 size={16} className="mr-2 animate-spin" /> Xarita yuklanmoqda…
          </div>
        )}
        {ready && located.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] flex justify-center">
            <span className={`rounded-full px-3 py-1 text-[11px] shadow ${isLight ? 'bg-white text-slate-600' : 'bg-slate-900 text-slate-300'}`}>
              Hali xaritadan manzil tanlagan talaba yo‘q
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
