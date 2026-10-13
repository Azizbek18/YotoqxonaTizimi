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
const ESRI_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'
const ESRI_ATTRIBUTION = '&copy; Esri &mdash; Esri, HERE, Garmin, OpenStreetMap contributors'

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
    const style = isLight ? 'World_Light_Gray_Base' : 'World_Dark_Gray_Base'
    tileRef.current = L.tileLayer(`${ESRI_BASE}/${style}/MapServer/tile/{z}/{y}/{x}`, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 18,
      maxNativeZoom: 16,
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
      const marker = L.circleMarker(pos, {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: '#6366f1',
        fillOpacity: 0.95,
      }).addTo(layer)
      marker.bindPopup(
        `<strong>${escapeHtml(s.full_name)}</strong><br/><span style="font-size:11px">${escapeHtml(s.residence_address ?? '')}</span>`,
      )
      if (onOpen) marker.on('dblclick', () => onOpen(s.id))
    }
    if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, students])

  return (
    <div className={`overflow-hidden rounded-2xl border ${ui.card}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h3 className={`flex items-center gap-2 text-sm font-bold ${ui.strong}`}>
          <MapPin size={15} className="text-indigo-500" /> Yashash joylari xaritasi
        </h3>
        <span className={`text-[11px] ${ui.muted}`}>
          {located.length} / {students.length} ta talaba xaritada
        </span>
      </div>
      <div className="relative">
        <div ref={boxRef} className="h-[320px] w-full" />
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
