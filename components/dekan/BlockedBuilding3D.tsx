'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MousePointer2 } from 'lucide-react'
import * as THREE from 'three'
import { getRoomOccupancyTone } from '@/features/app-settings/presentation'
import { useScopedFontFamily } from '@/lib/font-scope-context'
import type { BlockedRoomSection } from '@/features/dorms/types'
import { CORRIDOR_WIDTH, sectionFloorLayout } from '@/lib/blocked-building-3d'

interface Props {
  /** The section (block + floor) chosen in the chips above. */
  section: BlockedRoomSection
  isLight: boolean
  /** Fired when a room box is clicked. */
  onPickRoom: (roomNumber: string) => void
}

// Same palette as /dekan/3d-xonalar so the two makets read alike.
const ROOM_COLOR = { empty: 0x10b981, partial: 0xf59e0b, full: 0xef4444, unknown: 0x64748b } as const
const FROZEN_COLOR = 0x06b6d4

type Hover = { roomNumber: string; clientX: number; clientY: number } | null

export default function BlockedBuilding3D({ section, isLight, onPickRoom }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hovered, setHovered] = useState<Hover>(null)
  const scopedFontFamily = useScopedFontFamily()
  const pickRef = useRef(onPickRoom)
  useEffect(() => { pickRef.current = onPickRoom }, [onPickRoom])

  const layout = useMemo(() => sectionFloorLayout(section.rooms), [section.rooms])
  const occupantsByRoom = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of section.rooms) m.set(r.roomNumber, r.occupants.map((o) => o.name))
    return m
  }, [section.rooms])

  // --- 3D scene, a near-clone of app/dekan/3d-xonalar/page.tsx ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || layout.rooms.length === 0) return

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

    const slabGeo = new THREE.BoxGeometry(layout.slabWidth, 0.15, layout.slabDepth)
    const slabMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0xe2e8f0 : 0x111827,
      roughness: 0.8,
      metalness: 0.1,
    })
    const slabMesh = new THREE.Mesh(slabGeo, slabMat)
    slabMesh.position.set(0, -0.075, 0)
    roomGroup.add(slabMesh)

    const slabEdges = new THREE.EdgesGeometry(slabGeo)
    const slabLineMat = new THREE.LineBasicMaterial({ color: isLight ? 0x94a3b8 : 0x475569 })
    slabMesh.add(new THREE.LineSegments(slabEdges, slabLineMat))

    const corridorGeo = new THREE.BoxGeometry(CORRIDOR_WIDTH, 0.02, layout.slabDepth - 0.3)
    const corridorMat = new THREE.MeshStandardMaterial({ color: isLight ? 0xcbd5e1 : 0x1e293b, roughness: 0.9 })
    const corridorMesh = new THREE.Mesh(corridorGeo, corridorMat)
    corridorMesh.position.set(0, 0.01, 0)
    roomGroup.add(corridorMesh)

    const meshes: THREE.Mesh[] = []
    const disposables: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = []

    layout.rooms.forEach((room) => {
      const tone = getRoomOccupancyTone(room.occupied, room.capacity)
      // A frozen room is cyan regardless of occupancy — reads as "out of
      // circulation", matching the Xonalar xaritasi and 3d-xonalar.
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
    let prevMousePos = { x: 0, y: 0 }
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const pickAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      return raycaster.intersectObjects(meshes)[0]?.object as THREE.Mesh | undefined
    }
    const orbit = (dx: number, dy: number) => {
      roomGroup.rotation.y += dx * 0.005
      roomGroup.rotation.x += dy * 0.005
      roomGroup.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, roomGroup.rotation.x))
    }

    const onMouseDown = (e: MouseEvent) => { isDragging = true; prevMousePos = { x: e.offsetX, y: e.offsetY } }
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        orbit(e.offsetX - prevMousePos.x, e.offsetY - prevMousePos.y)
        prevMousePos = { x: e.offsetX, y: e.offsetY }
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
      pickRef.current(mesh.name)
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

    let animationFrameId = 0
    let running = true
    const io = new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting
      if (running && !animationFrameId) animate()
    }, { threshold: 0.05 })
    io.observe(canvas)
    const animate = () => {
      if (!running) { animationFrameId = 0; return }
      animationFrameId = requestAnimationFrame(animate)
      if (!isDragging) roomGroup.rotation.y += 0.0015
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      io.disconnect()
      resizeObserver.disconnect()
      cancelAnimationFrame(animationFrameId)
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
  }, [layout, isLight])

  if (layout.rooms.length === 0) return null

  const pill = `flex items-center gap-2 px-3 py-1.5 rounded-full border ${
    isLight ? 'border-slate-200 bg-white/80 text-slate-700' : 'border-white/10 bg-white/[0.04] text-slate-200'
  }`

  return (
    <div
      className={`relative min-h-[420px] overflow-hidden rounded-2xl border ${
        isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-slate-900/40'
      }`}
    >
      <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
        {([
          ['#10b981', 'Bo‘sh'],
          ['#f59e0b', 'Qisman'],
          ['#ef4444', 'To‘la'],
          ['#06b6d4', 'Muzlatilgan'],
        ] as const).map(([c, label]) => (
          <div key={label} className={pill}>
            <span className="h-2 w-2 rounded-full" style={{ background: c }} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
          </div>
        ))}
      </div>

      <canvas ref={canvasRef} className="block h-[420px] w-full cursor-grab outline-none active:cursor-grabbing" />

      {hovered && typeof document !== 'undefined' && createPortal(
        (() => {
          const names = occupantsByRoom.get(hovered.roomNumber) ?? []
          return (
            <div
              className={`pointer-events-none fixed z-[9999] rounded-xl border px-3 py-2 shadow-2xl backdrop-blur-xl ${
                isLight ? 'border-slate-200 bg-white/95' : 'border-slate-800 bg-slate-900/95'
              }`}
              style={{ left: hovered.clientX + 14, top: hovered.clientY + 14, fontFamily: scopedFontFamily }}
            >
              <p className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {section.block}{section.floor}-xona {hovered.roomNumber}
              </p>
              <p className={`mt-0.5 max-w-[220px] text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {names.length > 0 ? names.join(', ') : 'Bo‘sh'}
              </p>
            </div>
          )
        })(),
        document.body,
      )}

      <div className="pointer-events-none absolute bottom-4 left-4">
        <p
          className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${
            isLight ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          <MousePointer2 size={12} />
          Aylantirish uchun sudrang, tanlash uchun xonani bosing.
        </p>
      </div>
    </div>
  )
}
