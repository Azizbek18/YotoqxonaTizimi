'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DoorClosed, MousePointer2, Pause, Play, Snowflake, Users, X } from 'lucide-react'
import * as THREE from 'three'
import { getRoomOccupancyTone } from '@/features/app-settings/presentation'
import { useScopedFontFamily } from '@/lib/font-scope-context'
import { dekanUI } from '@/lib/dekan-ui'

/** One room already positioned on the floor slab (units = three.js world). */
export type SceneRoom = {
  roomNumber: string
  x: number
  z: number
  width: number
  depth: number
  height: number
  frozen: boolean
  /** Effective bed count, or null when the dorm default is still unknown. */
  capacity: number | null
  occupied: number
  /** Occupant display names, for the hover tooltip and the click card. */
  occupants: string[]
  isCapacityOverride?: boolean
}

interface Props {
  rooms: SceneRoom[]
  slabWidth: number
  slabDepth: number
  corridorWidth: number
  isLight: boolean
  /** Shown centred when there are no rooms to draw. */
  emptyHint?: string
  /** Rendered inside the click card, under the occupant list (e.g. a "place a student" button). */
  renderCardAction?: (roomNumber: string) => ReactNode
  /** Overrides the root border/background classes (keeps the layout classes). */
  className?: string
}

const ROOM_COLOR = { empty: 0x10b981, partial: 0xf59e0b, full: 0xef4444, unknown: 0x64748b } as const
const FROZEN_COLOR = 0x06b6d4

type Hover = { roomNumber: string; clientX: number; clientY: number } | null

const freePlaces = (r: SceneRoom) =>
  r.frozen || r.capacity === null ? null : Math.max(0, r.capacity - r.occupied)

export default function RoomScene3D({
  rooms, slabWidth, slabDepth, corridorWidth, isLight, emptyHint, renderCardAction, className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scopedFontFamily = useScopedFontFamily()

  const [hovered, setHovered] = useState<Hover>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)

  const roomByNumber = useMemo(() => {
    const m = new Map<string, SceneRoom>()
    for (const r of rooms) m.set(r.roomNumber, r)
    return m
  }, [rooms])

  // The animation loop reads live state through refs so toggling rotation or
  // hovering never tears down and rebuilds the whole Three.js scene.
  const autoRotateRef = useRef(autoRotate)
  const pauseForInteractionRef = useRef(false)
  useEffect(() => { autoRotateRef.current = autoRotate }, [autoRotate])
  useEffect(() => { pauseForInteractionRef.current = Boolean(hovered) || selected !== null }, [hovered, selected])

  // A room that vanished from the data (floor switch) must not stay selected.
  useEffect(() => {
    if (selected !== null && !roomByNumber.has(selected)) setSelected(null)
  }, [roomByNumber, selected])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || rooms.length === 0) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight

    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(45, width / Math.max(height, 1), 0.1, 100)
    camera.position.set(0, 5, 8)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(width, height, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const resizeObserver = new ResizeObserver(() => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    })
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight1.position.set(5, 10, 7)
    scene.add(dirLight1)
    const dirLight2 = new THREE.DirectionalLight(0x6366f1, 0.4)
    dirLight2.position.set(-5, 5, -5)
    scene.add(dirLight2)

    const roomGroup = new THREE.Group()
    scene.add(roomGroup)

    const slabGeo = new THREE.BoxGeometry(slabWidth, 0.15, slabDepth)
    const slabMat = new THREE.MeshStandardMaterial({ color: isLight ? 0xe2e8f0 : 0x111827, roughness: 0.8, metalness: 0.1 })
    const slabMesh = new THREE.Mesh(slabGeo, slabMat)
    slabMesh.position.set(0, -0.075, 0)
    roomGroup.add(slabMesh)
    const slabEdges = new THREE.EdgesGeometry(slabGeo)
    const slabLineMat = new THREE.LineBasicMaterial({ color: isLight ? 0x94a3b8 : 0x475569 })
    slabMesh.add(new THREE.LineSegments(slabEdges, slabLineMat))

    const corridorGeo = new THREE.BoxGeometry(corridorWidth, 0.02, slabDepth - 0.3)
    const corridorMat = new THREE.MeshStandardMaterial({ color: isLight ? 0xcbd5e1 : 0x1e293b, roughness: 0.9 })
    const corridorMesh = new THREE.Mesh(corridorGeo, corridorMat)
    corridorMesh.position.set(0, 0.01, 0)
    roomGroup.add(corridorMesh)

    const meshes: THREE.Mesh[] = []
    const disposables: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = []

    rooms.forEach((room) => {
      const tone = getRoomOccupancyTone(room.occupied, room.capacity)
      const color = room.frozen ? FROZEN_COLOR : ROOM_COLOR[tone]

      const geo = new THREE.BoxGeometry(room.width, room.height, room.depth)
      const material = new THREE.MeshStandardMaterial({
        color, roughness: 0.2, metalness: 0.1, transparent: true, opacity: room.frozen ? 0.55 : 0.85,
      })
      const mesh = new THREE.Mesh(geo, material)
      mesh.position.set(room.x, room.height / 2, room.z)
      mesh.name = room.roomNumber
      roomGroup.add(mesh)
      meshes.push(mesh)
      disposables.push({ geo, mat: material })

      const edges = new THREE.EdgesGeometry(geo)
      const lineMat = new THREE.LineBasicMaterial({ color })
      mesh.add(new THREE.LineSegments(edges, lineMat))
      disposables.push({ geo: edges, mat: lineMat })
    })

    let isDragging = false
    let prevMouse = { x: 0, y: 0 }
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()

    const pickAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      // Non-recursive: hit the solid room boxes only, never their wireframe
      // (LineSegments) children — those carry no name and would blank the card.
      const hit = raycaster.intersectObjects(meshes, false)[0]?.object
      if (!hit) return undefined
      let obj: THREE.Object3D | null = hit
      while (obj && !obj.name && obj.parent) obj = obj.parent
      return obj && obj.name ? (obj as THREE.Mesh) : undefined
    }
    const orbit = (dx: number, dy: number) => {
      roomGroup.rotation.y += dx * 0.005
      roomGroup.rotation.x += dy * 0.005
      roomGroup.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, roomGroup.rotation.x))
    }

    const onMouseDown = (e: MouseEvent) => { isDragging = true; prevMouse = { x: e.offsetX, y: e.offsetY } }
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        orbit(e.offsetX - prevMouse.x, e.offsetY - prevMouse.y)
        prevMouse = { x: e.offsetX, y: e.offsetY }
        setHovered(null)
        return
      }
      const mesh = pickAt(e.clientX, e.clientY)
      if (mesh) {
        canvas.style.cursor = 'pointer'
        setHovered({ roomNumber: mesh.name, clientX: e.clientX, clientY: e.clientY })
      } else {
        canvas.style.cursor = 'grab'
        setHovered(null)
      }
    }
    const onMouseUp = () => { isDragging = false }
    const onMouseLeave = () => { setHovered(null); canvas.style.cursor = 'grab' }
    const onClick = (e: MouseEvent) => {
      const mesh = pickAt(e.clientX, e.clientY)
      if (!mesh) return
      mesh.scale.set(1.08, 1.08, 1.08)
      setTimeout(() => mesh.scale.set(1, 1, 1), 150)
      setSelected(mesh.name)
    }
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    canvas.addEventListener('click', onClick)
    window.addEventListener('mouseup', onMouseUp)

    let touchPrev = { x: 0, y: 0 }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) { isDragging = true; touchPrev = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return
      const t = e.touches[0]
      orbit(t.clientX - touchPrev.x, t.clientY - touchPrev.y)
      touchPrev = { x: t.clientX, y: t.clientY }
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onMouseUp)

    let frameId = 0
    let onScreen = true
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen && !frameId) animate()
    }, { threshold: 0.05 })
    io.observe(canvas)
    const animate = () => {
      if (!onScreen) { frameId = 0; return }
      frameId = requestAnimationFrame(animate)
      if (!isDragging && autoRotateRef.current && !pauseForInteractionRef.current) {
        roomGroup.rotation.y += 0.0015
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      io.disconnect()
      resizeObserver.disconnect()
      cancelAnimationFrame(frameId)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onMouseUp)
      window.removeEventListener('mouseup', onMouseUp)
      setHovered(null)
      disposables.forEach(({ geo, mat }) => { geo.dispose(); mat.dispose() })
      slabGeo.dispose()
      slabMat.dispose()
      slabEdges.dispose()
      slabLineMat.dispose()
      corridorGeo.dispose()
      corridorMat.dispose()
      renderer.dispose()
    }
  }, [rooms, slabWidth, slabDepth, corridorWidth, isLight])

  const capacityKnown = rooms.some((r) => r.capacity != null)
  const anyFrozen = rooms.some((r) => r.frozen)
  const pill = `flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
    isLight ? 'border-slate-200 bg-white/85 text-slate-700' : 'border-white/10 bg-white/[0.05] text-slate-200'
  }`
  const legend: Array<[string, string]> = [['#10b981', 'Bo‘sh']]
  if (capacityKnown) legend.push(['#f59e0b', 'Qisman'], ['#ef4444', 'To‘la'])
  else legend.push(['#64748b', 'Sig‘im noma‘lum'])
  if (anyFrozen) legend.push(['#06b6d4', 'Muzlatilgan'])

  const hoverRoom = hovered ? roomByNumber.get(hovered.roomNumber) : undefined
  const selectedRoom = selected ? roomByNumber.get(selected) : undefined

  // Cursor-anchored placement for the hover card, flipped away from the
  // viewport edge so it never spills off-screen.
  const hoverPos = (() => {
    if (!hovered || typeof window === 'undefined') return { left: 0, top: 0 }
    const W = 268
    const H = 340
    const flipX = hovered.clientX > window.innerWidth - W - 24
    const flipY = hovered.clientY > window.innerHeight - H - 24
    return {
      left: Math.max(8, flipX ? hovered.clientX - W - 16 : hovered.clientX + 16),
      top: Math.max(8, Math.min(flipY ? hovered.clientY - H - 8 : hovered.clientY + 16, window.innerHeight - 120)),
    }
  })()

  return (
    <div className={`relative min-h-[420px] overflow-hidden rounded-2xl border ${
      className ?? (isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-slate-900/40')
    }`}>
      {/* legend */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
        {legend.map(([c, label]) => (
          <div key={label} className={pill}>
            <span className="h-2 w-2 rounded-full" style={{ background: c }} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
          </div>
        ))}
      </div>

      {/* auto-rotate toggle */}
      {rooms.length > 0 && (
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          className={`absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            isLight ? 'border-slate-200 bg-white/85 text-slate-700 hover:bg-white' : 'border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/10'
          }`}
          title={autoRotate ? "Aylanishni to‘xtatish" : 'Aylantirish'}
        >
          {autoRotate ? <Pause size={11} /> : <Play size={11} />}
          {autoRotate ? 'To‘xtatish' : 'Aylantirish'}
        </button>
      )}

      {rooms.length === 0 ? (
        <div className="flex h-[420px] flex-col items-center justify-center px-6 text-center">
          <p className={`text-sm font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            {emptyHint ?? 'Hali xona qo‘shilmagan.'}
          </p>
        </div>
      ) : (
        <canvas ref={canvasRef} className="block h-[420px] w-full cursor-grab outline-none active:cursor-grabbing" />
      )}

      {/* hover card — follows the cursor, portalled out so an ancestor
          transform / overflow can't clip it */}
      {hovered && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[9999]"
          style={{ left: hoverPos.left, top: hoverPos.top, fontFamily: scopedFontFamily }}
        >
          <RoomInfoCard room={hoverRoom} roomNumber={hovered.roomNumber} isLight={isLight} maxNames={5} />
        </div>,
        document.body,
      )}

      {/* click card — pinned in a corner, stays while you inspect the model */}
      {selected && selectedRoom && (
        <div className="absolute bottom-3 right-3 z-20 max-w-[calc(100%-1.5rem)]">
          <RoomInfoCard
            room={selectedRoom}
            roomNumber={selected}
            isLight={isLight}
            onClose={() => setSelected(null)}
            action={renderCardAction?.(selectedRoom.roomNumber)}
          />
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3">
        <p className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${
          isLight ? 'text-slate-400' : 'text-slate-500'
        }`}>
          <MousePointer2 size={12} />
          Aylantirish uchun sudrang, tanlash uchun xonani bosing.
        </p>
      </div>
    </div>
  )
}

// ── room info card ──────────────────────────────────────────────────────────
// One presentational card, shared by the hover (cursor-anchored) and the
// click (pinned + closeable) states so they read identically.

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

type RoomStatusKey = 'empty' | 'partial' | 'full' | 'frozen' | 'unknown'

const roomStatus = (r: SceneRoom): { key: RoomStatusKey; label: string } => {
  if (r.frozen) return { key: 'frozen', label: 'Muzlatilgan' }
  if (r.capacity === null) return { key: r.occupied > 0 ? 'partial' : 'empty', label: r.occupied > 0 ? 'Band' : "Bo‘sh" }
  if (r.occupied <= 0) return { key: 'empty', label: "Bo‘sh" }
  if (r.occupied >= r.capacity) return { key: 'full', label: "To‘la" }
  return { key: 'partial', label: 'Qisman' }
}

const STATUS_HEX: Record<RoomStatusKey, string> = {
  empty: '#10b981', partial: '#f59e0b', full: '#ef4444', frozen: '#06b6d4', unknown: '#64748b',
}

function RoomInfoCard({
  room, roomNumber, isLight, onClose, action, maxNames,
}: {
  room: SceneRoom | undefined
  roomNumber: string
  isLight: boolean
  onClose?: () => void
  action?: ReactNode
  maxNames?: number
}) {
  const ui = dekanUI(isLight)
  const st = room ? roomStatus(room) : null
  const hex = st ? STATUS_HEX[st.key] : STATUS_HEX.unknown
  const cap = room?.capacity ?? null
  const occ = room?.occupied ?? 0
  const free = room ? freePlaces(room) : null
  const names = room?.occupants ?? []
  const shown = maxNames ? names.slice(0, maxNames) : names
  const rest = names.length - shown.length

  const chipTone: Record<RoomStatusKey, string> = {
    empty: isLight ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' : 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/20',
    partial: isLight ? 'bg-amber-50 text-amber-700 ring-amber-600/15' : 'bg-amber-500/12 text-amber-300 ring-amber-400/20',
    full: isLight ? 'bg-rose-50 text-rose-700 ring-rose-600/15' : 'bg-rose-500/12 text-rose-300 ring-rose-400/20',
    frozen: isLight ? 'bg-cyan-50 text-cyan-700 ring-cyan-600/15' : 'bg-cyan-500/12 text-cyan-300 ring-cyan-400/20',
    unknown: isLight ? 'bg-slate-100 text-slate-600 ring-slate-500/15' : 'bg-slate-700/40 text-slate-300 ring-slate-400/20',
  }

  return (
    <div className={`w-[268px] overflow-hidden rounded-2xl border backdrop-blur-xl ${
      isLight
        ? 'border-slate-200/80 bg-white/95 shadow-[0_10px_34px_-10px_rgba(79,70,229,0.30),0_2px_8px_rgba(15,23,42,0.06)]'
        : 'border-slate-700/70 bg-slate-900/95 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.65)]'
    }`}>
      {/* header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ui.accentTileSoft}`}>
          {st?.key === 'frozen' ? <Snowflake size={16} /> : <DoorClosed size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-bold leading-tight ${ui.strong}`}>Xona {roomNumber}</p>
          <p className={`mt-0.5 truncate text-[11px] ${ui.faint}`}>
            {cap !== null ? `${cap} o‘rinli` : 'sig‘im noma‘lum'}
            {room?.isCapacityOverride && !room?.frozen ? ' · istisno sig‘im' : ''}
          </p>
        </div>
        {st && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${chipTone[st.key]}`}>
            {st.label}
          </span>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={`pointer-events-auto -mr-1 shrink-0 rounded-lg p-1 ${isLight ? 'text-slate-400 hover:bg-slate-100' : 'text-slate-500 hover:bg-white/10'}`}
            aria-label="Yopish"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* occupancy */}
      <div className={`mx-3.5 rounded-xl border px-3 py-2.5 ${ui.inset}`}>
        <div className="flex items-baseline justify-between">
          <p className={`text-sm font-bold tabular-nums ${ui.strong}`}>
            {occ}<span className={`text-xs font-semibold ${ui.faint}`}> / {cap ?? '?'}</span>
            <span className={`ml-1.5 text-[11px] font-semibold ${ui.muted}`}>band</span>
          </p>
          <p className={`text-[11px] font-semibold ${ui.muted}`}>
            {room?.frozen ? 'muzlatilgan' : free === null ? '' : `${free} bo‘sh`}
          </p>
        </div>
        {cap !== null && cap <= 16 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {Array.from({ length: cap }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-4 rounded-full"
                style={{ background: i < occ ? hex : isLight ? '#e2e8f0' : '#334155' }}
              />
            ))}
          </div>
        ) : cap !== null ? (
          <div className={`mt-2 h-1.5 w-full overflow-hidden rounded-full ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`}>
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.min(100, (occ / Math.max(cap, 1)) * 100)}%`, background: hex }}
            />
          </div>
        ) : null}
      </div>

      {/* occupants */}
      <div className="px-3.5 pt-2.5 pb-3.5">
        <p className={`mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${ui.faint}`}>
          <Users size={11} /> Yashovchilar
          {names.length > 0 && <span className="tabular-nums">· {names.length}</span>}
        </p>
        {names.length === 0 ? (
          <p className={`rounded-lg border border-dashed px-2.5 py-2 text-center text-[11px] ${isLight ? 'border-slate-200 text-slate-400' : 'border-slate-700 text-slate-500'}`}>
            {room?.frozen ? 'Muzlatilgan — hech kim yo‘q' : 'Xona bo‘sh'}
          </p>
        ) : (
          <div className="max-h-[176px] space-y-1 overflow-y-auto">
            {shown.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${isLight ? 'bg-slate-50' : 'bg-white/[0.03]'}`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${ui.accentTileSoft}`}>
                  {initials(name)}
                </span>
                <span className={`truncate text-xs ${ui.body}`}>{name}</span>
              </div>
            ))}
            {rest > 0 && (
              <p className={`px-1.5 pt-0.5 text-[11px] font-semibold ${ui.faint}`}>+{rest} ta yana</p>
            )}
          </div>
        )}
      </div>

      {action && <div className="border-t px-3.5 py-2.5" style={{ borderColor: isLight ? '#e2e8f0' : '#334155' }}>{action}</div>}
    </div>
  )
}
