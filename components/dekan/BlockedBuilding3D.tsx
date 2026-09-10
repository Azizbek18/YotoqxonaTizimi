'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { getRoomOccupancyTone } from '@/features/app-settings/presentation'
import type { BlockedRoomMapDorm } from '@/features/dorms/types'
import {
  BLOCK_GAP,
  FLOOR_HEIGHT,
  SECTION_DEPTH,
  SECTION_WIDTH,
  sectionOccupancy,
  sectionPlacement,
} from '@/lib/blocked-building-3d'

interface Props {
  dorm: BlockedRoomMapDorm
  /** `${block}-${floor}` of the section selected in the page above. */
  activeKey: string
  onSelectSection: (key: string) => void
  isLight: boolean
}

const TONE_COLOR: Record<ReturnType<typeof getRoomOccupancyTone>, number> = {
  empty: 0x64748b,   // slate — nothing placed yet
  partial: 0x6366f1, // indigo — filling up
  full: 0xf59e0b,    // amber — full
  unknown: 0x94a3b8,
}

type Hover = { key: string; label: string; x: number; y: number } | null

export default function BlockedBuilding3D({ dorm, activeKey, onSelectSection, isLight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [hover, setHover] = useState<Hover>(null)
  // keep the freshest callback without re-running the scene effect
  const onSelectRef = useRef(onSelectSection)
  useEffect(() => { onSelectRef.current = onSelectSection }, [onSelectSection])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dorm.sections.length === 0) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const scene = new THREE.Scene()

    const camera = new THREE.PerspectiveCamera(42, width / Math.max(height, 1), 0.1, 100)
    const reach = Math.max(dorm.floorCount * FLOOR_HEIGHT, BLOCK_GAP * dorm.blockCount)
    camera.position.set(0, reach * 0.15, reach * 1.25 + 3)
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

    scene.add(new THREE.AmbientLight(0xffffff, 0.68))
    const key = new THREE.DirectionalLight(0xffffff, 0.85)
    key.position.set(6, 10, 8)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x6366f1, 0.35)
    fill.position.set(-6, 4, -6)
    scene.add(fill)

    const group = new THREE.Group()
    scene.add(group)

    const disposables: { dispose(): void }[] = []
    const track = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x }

    // --- ghost frame: an empty wireframe box for every block × floor ---
    const ghostGeo = track(new THREE.BoxGeometry(SECTION_WIDTH, FLOOR_HEIGHT * 0.82, SECTION_DEPTH))
    const ghostEdges = track(new THREE.EdgesGeometry(ghostGeo))
    const ghostMat = track(new THREE.LineBasicMaterial({
      color: isLight ? 0xcbd5e1 : 0x334155,
      transparent: true,
      opacity: 0.55,
    }))
    for (let b = 0; b < dorm.blockCount; b += 1) {
      const block = String.fromCharCode(65 + b)
      for (let floor = 1; floor <= dorm.floorCount; floor += 1) {
        const { x, y, z } = sectionPlacement(block, floor, dorm.blockCount, dorm.floorCount)
        const line = new THREE.LineSegments(ghostEdges, ghostMat)
        line.position.set(x, y, z)
        group.add(line)
      }
    }

    // --- solid boxes for the faculty's own sections ---
    const meshes: THREE.Mesh[] = []
    const labelByKey = new Map<string, string>()
    for (const s of dorm.sections) {
      const key = `${s.block}-${s.floor}`
      const { filled, total } = sectionOccupancy(s.rooms)
      const tone = getRoomOccupancyTone(filled, total || null)
      const isActive = key === activeKey
      const geo = track(new THREE.BoxGeometry(SECTION_WIDTH * 0.9, FLOOR_HEIGHT * 0.7, SECTION_DEPTH * 0.9))
      const mat = track(new THREE.MeshStandardMaterial({
        color: TONE_COLOR[tone],
        roughness: 0.55,
        metalness: 0.1,
        emissive: isActive ? TONE_COLOR[tone] : 0x000000,
        emissiveIntensity: isActive ? 0.45 : 0,
      }))
      const { x, y, z } = sectionPlacement(s.block, s.floor, dorm.blockCount, dorm.floorCount)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      mesh.name = key
      group.add(mesh)
      meshes.push(mesh)
      const gender = s.gender === 'male' ? " · o‘g‘il" : s.gender === 'female' ? ' · qiz' : ''
      labelByKey.set(key, `${s.block}${s.floor} · ${filled}/${total}${gender}`)
    }

    // --- interaction ---
    let dragging = false
    let prev = { x: 0, y: 0 }
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()

    const pick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      return raycaster.intersectObjects(meshes)[0]?.object as THREE.Mesh | undefined
    }

    const onDown = (e: MouseEvent) => { dragging = true; prev = { x: e.offsetX, y: e.offsetY } }
    const onUp = () => { dragging = false }
    const onMove = (e: MouseEvent) => {
      if (dragging) {
        group.rotation.y += (e.offsetX - prev.x) * 0.006
        group.rotation.x = Math.max(-Math.PI / 5, Math.min(Math.PI / 5, group.rotation.x + (e.offsetY - prev.y) * 0.006))
        prev = { x: e.offsetX, y: e.offsetY }
        setHover(null)
        return
      }
      const hit = pick(e)
      if (hit) {
        canvas.style.cursor = 'pointer'
        setHover({ key: hit.name, label: labelByKey.get(hit.name) ?? hit.name, x: e.clientX, y: e.clientY })
      } else {
        canvas.style.cursor = 'grab'
        setHover(null)
      }
    }
    const onLeave = () => { setHover(null); canvas.style.cursor = 'grab' }
    const onClick = (e: MouseEvent) => {
      const hit = pick(e)
      if (hit) onSelectRef.current(hit.name)
    }
    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('click', onClick)
    window.addEventListener('mouseup', onUp)

    // touch: one-finger drag to spin
    let touchPrev = { x: 0, y: 0 }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      dragging = true
      touchPrev = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging || e.touches.length !== 1) return
      const t = e.touches[0]
      group.rotation.y += (t.clientX - touchPrev.x) * 0.006
      group.rotation.x = Math.max(-Math.PI / 5, Math.min(Math.PI / 5, group.rotation.x + (t.clientY - touchPrev.y) * 0.006))
      touchPrev = { x: t.clientX, y: t.clientY }
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onUp)

    // --- render loop, paused while the canvas is off-screen ---
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
      if (!dragging) group.rotation.y += 0.0016
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

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-xl">
      <canvas ref={canvasRef} className="block h-full w-full cursor-grab outline-none active:cursor-grabbing" />
      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-slate-900/90 px-2 py-1 text-[11px] font-semibold text-white shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.label}
        </div>
      )}
      <p className={`absolute bottom-1.5 left-2 text-[9px] font-medium ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
torting — aylantirish · seksiyani bosing
      </p>
    </div>
  )
}
