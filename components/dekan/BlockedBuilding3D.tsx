'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { getRoomOccupancyTone } from '@/features/app-settings/presentation'
import type { BlockedRoomMapDorm } from '@/features/dorms/types'
import {
  CORRIDOR_W,
  ROOM_D,
  ROOM_H,
  ROOM_W,
  SLAB_D,
  SLAB_W,
  sectionPlacement,
  sectionRoomLayout,
} from '@/lib/blocked-building-3d'

interface Props {
  dorm: BlockedRoomMapDorm
  /** `${block}-${floor}` of the section selected in the page above. */
  activeKey: string
  /** Fired when a room box is clicked. */
  onPickRoom: (block: string, floor: number, roomNumber: string) => void
  isLight: boolean
}

// Same palette as /dekan/3d-xonalar so the two views read alike.
const ROOM_COLOR = { empty: 0x10b981, partial: 0xf59e0b, full: 0xef4444, unknown: 0x64748b } as const
const FROZEN_COLOR = 0x06b6d4

const genderTag = (g: 'male' | 'female' | null) => (g === 'male' ? " · o‘g‘il" : g === 'female' ? ' · qiz' : '')

type Hover = { label: string; x: number; y: number } | null

export default function BlockedBuilding3D({ dorm, activeKey, onPickRoom, isLight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hover, setHover] = useState<Hover>(null)
  const pickRef = useRef(onPickRoom)
  useEffect(() => { pickRef.current = onPickRoom }, [onPickRoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dorm.sections.length === 0) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const template = sectionRoomLayout()

    const scene = new THREE.Scene()
    const group = new THREE.Group()
    scene.add(group)

    const disposables: { dispose(): void }[] = []
    const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x }

    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 0.85); key.position.set(8, 12, 9); scene.add(key)
    const fill = new THREE.DirectionalLight(0x6366f1, 0.35); fill.position.set(-8, 5, -7); scene.add(fill)

    // --- per-block context pole + floor ticks ---
    const ownBlocks = new Set(dorm.sections.map((s) => s.block))
    const tickGeo = keep(new THREE.BoxGeometry(0.12, 0.12, 0.12))
    const poleMat = keep(new THREE.MeshStandardMaterial({ color: isLight ? 0xcbd5e1 : 0x334155 }))
    const tickDim = keep(new THREE.MeshStandardMaterial({ color: isLight ? 0x94a3b8 : 0x475569 }))
    const tickOn = keep(new THREE.MeshStandardMaterial({ color: 0x6366f1, emissive: 0x6366f1, emissiveIntensity: 0.4 }))
    for (const block of ownBlocks) {
      const bottom = sectionPlacement(block, 1, dorm.blockCount, dorm.floorCount)
      const top = sectionPlacement(block, dorm.floorCount, dorm.blockCount, dorm.floorCount)
      const poleGeo = keep(new THREE.BoxGeometry(0.06, Math.max(top.y - bottom.y, 0.1) + 0.4, 0.06))
      const pole = new THREE.Mesh(poleGeo, poleMat)
      pole.position.set(bottom.x - SLAB_W / 2 - 0.5, (top.y + bottom.y) / 2, -SLAB_D / 2)
      group.add(pole)
      const ownFloors = new Set(dorm.sections.filter((s) => s.block === block).map((s) => s.floor))
      for (let f = 1; f <= dorm.floorCount; f += 1) {
        const p = sectionPlacement(block, f, dorm.blockCount, dorm.floorCount)
        const tick = new THREE.Mesh(tickGeo, ownFloors.has(f) ? tickOn : tickDim)
        tick.position.set(p.x - SLAB_W / 2 - 0.5, p.y, -SLAB_D / 2)
        group.add(tick)
      }
    }

    // --- each owned section: a floor plate + corridor + 9 room boxes ---
    const meshes: THREE.Mesh[] = []
    const labelByName = new Map<string, string>()
    const slabMat = keep(new THREE.MeshStandardMaterial({ color: isLight ? 0xe2e8f0 : 0x0f172a, roughness: 0.9 }))
    const slabActiveMat = keep(new THREE.MeshStandardMaterial({
      color: isLight ? 0xe0e7ff : 0x1e1b4b, roughness: 0.8, emissive: 0x6366f1, emissiveIntensity: 0.22,
    }))
    const corridorMat = keep(new THREE.MeshStandardMaterial({ color: isLight ? 0xcbd5e1 : 0x1e293b, roughness: 1 }))
    const slabGeo = keep(new THREE.BoxGeometry(SLAB_W, 0.1, SLAB_D))
    const corridorGeo = keep(new THREE.BoxGeometry(CORRIDOR_W, 0.03, SLAB_D - 0.3))

    for (const s of dorm.sections) {
      const base = sectionPlacement(s.block, s.floor, dorm.blockCount, dorm.floorCount)
      const active = `${s.block}-${s.floor}` === activeKey
      const roomByNum = new Map(s.rooms.map((r) => [r.roomNumber, r]))

      const slab = new THREE.Mesh(slabGeo, active ? slabActiveMat : slabMat)
      slab.position.set(base.x, base.y, base.z)
      group.add(slab)
      const corridor = new THREE.Mesh(corridorGeo, corridorMat)
      corridor.position.set(base.x, base.y + 0.06, base.z)
      group.add(corridor)

      for (const slot of template) {
        const room = roomByNum.get(slot.roomNumber)
        const filled = room?.occupants.length ?? 0
        const cap = room?.capacity ?? slot.capacity
        const frozen = room?.frozen ?? false
        const tone = getRoomOccupancyTone(filled, cap)
        const color = frozen ? FROZEN_COLOR : ROOM_COLOR[tone]
        const geo = keep(new THREE.BoxGeometry(ROOM_W, ROOM_H, ROOM_D))
        const mat = keep(new THREE.MeshStandardMaterial({
          color, roughness: 0.35, metalness: 0.1, transparent: true, opacity: frozen ? 0.5 : 0.9,
        }))
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(base.x + slot.x, base.y + 0.05 + ROOM_H / 2, base.z + slot.z)
        mesh.name = `${s.block}|${s.floor}|${slot.roomNumber}`
        group.add(mesh)
        meshes.push(mesh)
        const edgeGeo = keep(new THREE.EdgesGeometry(geo))
        mesh.add(new THREE.LineSegments(edgeGeo, keep(new THREE.LineBasicMaterial({ color }))))
        labelByName.set(
          mesh.name,
          `${s.block}${s.floor}-${slot.roomNumber} · ${filled}/${cap}${frozen ? ' · muzlatilgan' : genderTag(room?.gender ?? s.gender)}`,
        )
      }
    }

    // Centre the content on the origin so it orbits around its middle, then
    // pull the camera back far enough to frame the bounding sphere.
    const sphere = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere())
    group.position.sub(sphere.center)
    const fov = 42
    const camera = new THREE.PerspectiveCamera(fov, width / Math.max(height, 1), 0.1, 200)
    const dist = (sphere.radius * 1.15) / Math.sin((fov * Math.PI) / 180 / 2)
    camera.position.set(dist * 0.32, dist * 0.26, dist * 0.9)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(width, height, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const resizeObserver = new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    })
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)

    // --- interaction ---
    let dragging = false
    let prev = { x: 0, y: 0 }
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const hit = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect()
      ndc.x = ((cx - rect.left) / rect.width) * 2 - 1
      ndc.y = -((cy - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      return raycaster.intersectObjects(meshes)[0]?.object as THREE.Mesh | undefined
    }
    const spin = (dx: number, dy: number) => {
      group.rotation.y += dx * 0.006
      group.rotation.x = Math.max(-Math.PI / 5, Math.min(Math.PI / 5, group.rotation.x + dy * 0.006))
    }
    const onDown = (e: MouseEvent) => { dragging = true; prev = { x: e.offsetX, y: e.offsetY } }
    const onUp = () => { dragging = false }
    const onMove = (e: MouseEvent) => {
      if (dragging) { spin(e.offsetX - prev.x, e.offsetY - prev.y); prev = { x: e.offsetX, y: e.offsetY }; setHover(null); return }
      const m = hit(e.clientX, e.clientY)
      if (m) { canvas.style.cursor = 'pointer'; setHover({ label: labelByName.get(m.name) ?? m.name, x: e.clientX, y: e.clientY }) }
      else { canvas.style.cursor = 'grab'; setHover(null) }
    }
    const onLeave = () => { setHover(null); canvas.style.cursor = 'grab' }
    const onClick = (e: MouseEvent) => {
      const m = hit(e.clientX, e.clientY)
      if (!m) return
      const [b, f, rn] = m.name.split('|')
      pickRef.current(b, Number(f), rn)
    }
    let tPrev = { x: 0, y: 0 }
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 1) { dragging = true; tPrev = { x: e.touches[0].clientX, y: e.touches[0].clientY } } }
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging || e.touches.length !== 1) return
      const t = e.touches[0]; spin(t.clientX - tPrev.x, t.clientY - tPrev.y); tPrev = { x: t.clientX, y: t.clientY }
    }
    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onUp)
    window.addEventListener('mouseup', onUp)

    let raf = 0
    let visible = true
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !raf) loop()
    }, { threshold: 0.05 })
    io.observe(canvas)
    const loop = () => {
      if (!visible) { raf = 0; return }
      raf = requestAnimationFrame(loop)
      if (!dragging) group.rotation.y += 0.0015
      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      resizeObserver.disconnect()
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onUp)
      window.removeEventListener('mouseup', onUp)
      setHover(null)
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
    }
  }, [dorm, activeKey, isLight])

  if (dorm.sections.length === 0) return null

  const dot = 'inline-block h-2 w-2 rounded-full mr-1 align-middle'
  return (
    <div>
      <div className="relative h-[340px] w-full overflow-hidden rounded-xl">
        <canvas ref={canvasRef} className="block h-full w-full cursor-grab outline-none active:cursor-grabbing" />
        {hover && (
          <div className="pointer-events-none fixed z-50 rounded-md bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-white shadow-lg"
            style={{ left: hover.x + 12, top: hover.y + 12 }}>
            {hover.label}
          </div>
        )}
        <p className={`absolute bottom-1.5 left-2 text-[9px] font-medium ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          torting — aylantirish · xonani bosing
        </p>
      </div>
      <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
        <span><span className={dot} style={{ background: '#10b981' }} />bo‘sh</span>
        <span><span className={dot} style={{ background: '#f59e0b' }} />qisman</span>
        <span><span className={dot} style={{ background: '#ef4444' }} />to‘la</span>
        <span><span className={dot} style={{ background: '#06b6d4' }} />muzlatilgan</span>
      </div>
    </div>
  )
}
