'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Building2, DoorOpen, Layers3, Users,
  Info, MousePointer2, ExternalLink,
  Plus, Trash2, ChevronUp, ChevronDown, Save, RotateCcw
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useScopedFontFamily } from '@/lib/font-scope-context'
import toast from 'react-hot-toast'
import * as THREE from 'three'
import { fetchAdminDashboard } from '@/features/admin-dashboard/client/api'
import { fetchFloorLayout, saveFloorLayout } from '@/features/room-layout/client/api'
import type { RoomBlockSide, RoomBlockSize, RoomLayoutBlock } from '@/features/room-layout/types'

interface StudentInfo {
  id: string
  name: string
}

interface RoomOccupancySnapshot {
  roomNumber: string
  occupied: number
  capacity: number
  students: StudentInfo[]
}

type EditableBlock = { roomNumber: string; size: RoomBlockSize }

const snapshotBlocks = (left: EditableBlock[], right: EditableBlock[]) => JSON.stringify({ left, right })

type PositionedRoom = {
  roomNumber: string
  side: RoomBlockSide
  size: RoomBlockSize
  x: number
  z: number
  width: number
  depth: number
  height: number
}

const CORRIDOR_WIDTH = 2.4
const GAP = 0.35
// Only the room's frontage along the row (`depth`, the Z-axis spacing between
// neighboring blocks) varies by size. The offset away from the corridor
// (`width`, the X-axis) and the height stay identical for every room, so a
// "large" room grows in line with its neighbors instead of jutting out
// sideways and looking detached from the row.
const ROOM_WIDTH = 1.8
const ROOM_HEIGHT = 1.0
const SIZE_UNITS: Record<RoomBlockSize, { width: number; depth: number; height: number }> = {
  small: { width: ROOM_WIDTH, depth: 1.3, height: ROOM_HEIGHT },
  medium: { width: ROOM_WIDTH, depth: 1.8, height: ROOM_HEIGHT },
  large: { width: ROOM_WIDTH, depth: 2.6, height: ROOM_HEIGHT },
}
const SIZE_LABELS: Record<RoomBlockSize, string> = { small: 'Kichik', medium: "O'rta", large: 'Katta' }

// Lays a side's ordered blocks out along Z, hugging the corridor on X,
// so rooms of different sizes never overlap regardless of their width.
function layoutSide(blocks: EditableBlock[], side: RoomBlockSide): { rooms: PositionedRoom[]; totalDepth: number; maxWidth: number } {
  let cursor = 0
  const raw = blocks
    .filter((b) => b.roomNumber.trim())
    .map((b) => {
      const units = SIZE_UNITS[b.size]
      const z = cursor + units.depth / 2
      cursor += units.depth + GAP
      return { roomNumber: b.roomNumber.trim(), size: b.size, z, ...units }
    })

  const totalDepth = Math.max(cursor - GAP, 0)
  const centerOffset = totalDepth / 2
  const maxWidth = raw.reduce((max, r) => Math.max(max, r.width), 0)
  const xSign = side === 'left' ? -1 : 1

  const rooms: PositionedRoom[] = raw.map((r) => ({
    roomNumber: r.roomNumber,
    side,
    size: r.size,
    x: xSign * (CORRIDOR_WIDTH / 2 + r.width / 2 + GAP),
    z: r.z - centerOffset,
    width: r.width,
    depth: r.depth,
    height: r.height,
  }))

  return { rooms, totalDepth, maxWidth }
}

export default function Admin3DXonalarPage() {
  const [roomSnapshots, setRoomSnapshots] = useState<RoomOccupancySnapshot[]>([])
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string | null>(null)
  const [hoveredRoom, setHoveredRoom] = useState<{ roomNumber: string; clientX: number; clientY: number } | null>(null)

  const [activeFloor, setActiveFloor] = useState<number>(1)
  const floors = [1, 2, 3, 4, 5]

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leftBlocks, setLeftBlocks] = useState<EditableBlock[]>([])
  const [rightBlocks, setRightBlocks] = useState<EditableBlock[]>([])
  // Snapshot of whatever's actually persisted on the server for the active
  // floor — compared against the live editor state so we can warn before
  // silently discarding unsaved edits (e.g. switching floor tabs).
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() => snapshotBlocks([], []))
  const isDirty = snapshotBlocks(leftBlocks, rightBlocks) !== lastSavedSnapshot

  // Debounced snapshot of the editable lists — the 3D scene rebuilds from
  // this instead of the raw state, so typing a room number doesn't tear
  // down and rebuild the whole Three.js scene on every keystroke.
  const [previewLeft, setPreviewLeft] = useState<EditableBlock[]>([])
  const [previewRight, setPreviewRight] = useState<EditableBlock[]>([])

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
  const scopedFontFamily = useScopedFontFamily()

  const surfaceBg = isLight ? 'bg-white/80 border-slate-200 shadow-lg' : 'bg-[#0b1120]/50 border-white/10 shadow-[0_0_20px_rgba(6,182,212,0.05)]'
  const cardBg = isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-white/[0.04] border-white/10'
  const textMuted = isLight ? 'text-slate-600' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'
  const inputBg = isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-white/5 border-white/10 text-white'

  const loadRoomOccupancy = async () => {
    try {
      const { students: data } = await fetchAdminDashboard()
      const occupancyMap = new Map<string, { count: number, students: StudentInfo[] }>()
      data?.forEach((user) => {
        if (!user.room_number) return
        const existing = occupancyMap.get(user.room_number) || { count: 0, students: [] }
        occupancyMap.set(user.room_number, {
          count: existing.count + 1,
          students: [...existing.students, { id: user.id, name: user.full_name ?? 'Noma\'lum' }]
        })
      })
      setRoomSnapshots(
        Array.from(occupancyMap.entries()).map(([roomNumber, info]) => ({
          roomNumber,
          occupied: info.count,
          students: info.students,
          capacity: 4,
        }))
      )
    } catch (error) {
      console.error('Xona bandligini yuklashda xato:', error)
      toast.error('Bandlik ma\'lumotlarini yuklashda xatolik yuz berdi')
    }
  }

  const loadFloorLayout = async (floor: number) => {
    setLoading(true)
    setSelectedRoomNumber(null)
    try {
      const blocks = await fetchFloorLayout(floor)
      const left = blocks.filter((b) => b.side === 'left').map((b) => ({ roomNumber: b.roomNumber, size: b.size }))
      const right = blocks.filter((b) => b.side === 'right').map((b) => ({ roomNumber: b.roomNumber, size: b.size }))
      setLeftBlocks(left)
      setRightBlocks(right)
      setLastSavedSnapshot(snapshotBlocks(left, right))
    } catch (error) {
      console.error('Qavat tarxini yuklashda xato:', error)
      toast.error('Qavat tarxini yuklab bo\'lmadi')
      setLeftBlocks([])
      setRightBlocks([])
      setLastSavedSnapshot(snapshotBlocks([], []))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadId = window.setTimeout(() => void loadRoomOccupancy(), 0)
    return () => window.clearTimeout(loadId)
  }, [])

  useEffect(() => {
    void loadFloorLayout(activeFloor)
  }, [activeFloor])

  // Warn before the browser tab is closed/refreshed with unsaved edits —
  // switching floors is guarded separately (see the floor tab buttons).
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  useEffect(() => {
    const id = setTimeout(() => {
      setPreviewLeft(leftBlocks)
      setPreviewRight(rightBlocks)
    }, 400)
    return () => clearTimeout(id)
  }, [leftBlocks, rightBlocks])

  // --- Editor mutations ---
  const addBlock = (side: RoomBlockSide) => {
    const setter = side === 'left' ? setLeftBlocks : setRightBlocks
    setter((prev) => [...prev, { roomNumber: '', size: 'medium' }])
  }
  const updateBlock = (side: RoomBlockSide, index: number, patch: Partial<EditableBlock>) => {
    const setter = side === 'left' ? setLeftBlocks : setRightBlocks
    setter((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  }
  const removeBlock = (side: RoomBlockSide, index: number) => {
    const setter = side === 'left' ? setLeftBlocks : setRightBlocks
    setter((prev) => prev.filter((_, i) => i !== index))
  }
  const moveBlock = (side: RoomBlockSide, index: number, direction: -1 | 1) => {
    const setter = side === 'left' ? setLeftBlocks : setRightBlocks
    setter((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleSave = async () => {
    // Bo'sh (raqami kiritilmagan) qatorlar shunchaki e'tiborsiz qoldiriladi —
    // avval bittasi bo'sh qolsa BUTUN saqlash bloklanardi, bu esa boshqa
    // to'ldirilgan xonalarning ham saqlanib qolishiga xalaqit berardi.
    const filledLeft = leftBlocks.filter((b) => b.roomNumber.trim())
    const filledRight = rightBlocks.filter((b) => b.roomNumber.trim())
    if (filledLeft.length === 0 && filledRight.length === 0) {
      toast.error("Kamida bitta xona qo'shing")
      return
    }

    const combined: RoomLayoutBlock[] = [
      ...filledLeft.map((b, i) => ({ roomNumber: b.roomNumber.trim(), side: 'left' as const, size: b.size, position: i })),
      ...filledRight.map((b, i) => ({ roomNumber: b.roomNumber.trim(), side: 'right' as const, size: b.size, position: i })),
    ]

    setSaving(true)
    try {
      await saveFloorLayout(activeFloor, combined)
      setLastSavedSnapshot(snapshotBlocks(leftBlocks, rightBlocks))
      toast.success(`${activeFloor}-qavat tarxi saqlandi`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlashda xatolik yuz berdi")
    } finally {
      setSaving(false)
    }
  }

  // --- 3D scene, driven by the debounced preview blocks ---
  const positionedRooms = useMemo(() => {
    const left = layoutSide(previewLeft, 'left')
    const right = layoutSide(previewRight, 'right')
    return {
      rooms: [...left.rooms, ...right.rooms],
      slabWidth: CORRIDOR_WIDTH + 2 * (Math.max(left.maxWidth, right.maxWidth, 1.8) + GAP) + 1,
      slabDepth: Math.max(left.totalDepth, right.totalDepth, 2) + 2,
    }
  }, [previewLeft, previewRight])

  useEffect(() => {
    const rooms = positionedRooms.rooms
    if (!canvasRef.current || rooms.length === 0) {
      if (groupRef.current) groupRef.current.clear()
      return
    }

    const canvas = canvasRef.current
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, width / Math.max(height, 1), 0.1, 100)
    camera.position.set(0, 5, 8)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(width, height, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer

    const resizeObserver = new ResizeObserver(() => {
      if (!canvas || !rendererRef.current) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
      rendererRef.current.setSize(w, h, false)
    })
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight1.position.set(5, 10, 7)
    scene.add(dirLight1)
    const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 0.5)
    dirLight2.position.set(-5, 5, -5)
    scene.add(dirLight2)

    const roomGroup = new THREE.Group()
    scene.add(roomGroup)
    groupRef.current = roomGroup

    const slabGeo = new THREE.BoxGeometry(positionedRooms.slabWidth, 0.15, positionedRooms.slabDepth)
    const slabMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0xe2e8f0 : 0x111827,
      roughness: 0.8,
      metalness: 0.1,
    })
    const slabMesh = new THREE.Mesh(slabGeo, slabMat)
    slabMesh.position.set(0, -0.075, 0)
    roomGroup.add(slabMesh)

    const slabEdges = new THREE.EdgesGeometry(slabGeo)
    const slabLineMat = new THREE.LineBasicMaterial({ color: isLight ? 0x94a3b8 : 0x06b6d4 })
    slabMesh.add(new THREE.LineSegments(slabEdges, slabLineMat))

    // Corridor strip down the middle, visually marking the "zal".
    const corridorGeo = new THREE.BoxGeometry(CORRIDOR_WIDTH, 0.02, positionedRooms.slabDepth - 0.3)
    const corridorMat = new THREE.MeshStandardMaterial({ color: isLight ? 0xcbd5e1 : 0x1e293b, roughness: 0.9 })
    const corridorMesh = new THREE.Mesh(corridorGeo, corridorMat)
    corridorMesh.position.set(0, 0.01, 0)
    roomGroup.add(corridorMesh)

    const meshes: THREE.Mesh[] = []
    const disposables: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = []

    rooms.forEach((room) => {
      const snap = roomSnapshots.find((s) => s.roomNumber === room.roomNumber)
      const occupied = snap?.occupied ?? 0

      let color = 0x10b981
      if (occupied >= 4) color = 0xef4444
      else if (occupied > 0) color = 0xf59e0b

      const geo = new THREE.BoxGeometry(room.width, room.height, room.depth)
      const material = new THREE.MeshStandardMaterial({
        color, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85,
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

    const onMouseDown = (e: MouseEvent) => { isDragging = true; prevMousePos = { x: e.offsetX, y: e.offsetY } }
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaMove = { x: e.offsetX - prevMousePos.x, y: e.offsetY - prevMousePos.y }
        roomGroup.rotation.y += deltaMove.x * 0.005
        roomGroup.rotation.x += deltaMove.y * 0.005
        roomGroup.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, roomGroup.rotation.x))
        prevMousePos = { x: e.offsetX, y: e.offsetY }
        setHoveredRoom(null)
        return
      }

      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(meshes)
      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object as THREE.Mesh
        canvas.style.cursor = 'pointer'
        setHoveredRoom({ roomNumber: hoveredMesh.name, clientX: e.clientX, clientY: e.clientY })
      } else {
        canvas.style.cursor = 'grab'
        setHoveredRoom(null)
      }
    }
    const onMouseUp = () => { isDragging = false }
    const onMouseLeave = () => { setHoveredRoom(null); canvas.style.cursor = 'grab' }
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('mouseup', onMouseUp)

    const onCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(meshes)
      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh
        setSelectedRoomNumber(clickedMesh.name)
        clickedMesh.scale.set(1.08, 1.08, 1.08)
        setTimeout(() => clickedMesh.scale.set(1, 1, 1), 150)
      }
    }
    canvas.addEventListener('click', onCanvasClick)

    let animationFrameId: number
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      if (!isDragging) roomGroup.rotation.y += 0.0015
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(animationFrameId)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('click', onCanvasClick)
      setHoveredRoom(null)
      disposables.forEach(({ geo, mat }) => { geo.dispose(); mat.dispose() })
      slabGeo.dispose()
      slabMat.dispose()
      corridorGeo.dispose()
      corridorMat.dispose()
      renderer.dispose()
    }
  }, [positionedRooms, roomSnapshots, isLight])

  const summary = useMemo(() => {
    const roomCount = positionedRooms.rooms.length
    const occupiedPlaces = roomSnapshots
      .filter((room) => positionedRooms.rooms.some((r) => r.roomNumber === room.roomNumber))
      .reduce((total, room) => total + room.occupied, 0)
    return {
      occupiedPlaces,
      totalRooms: roomCount,
      freePlaces: Math.max(roomCount * 4 - occupiedPlaces, 0),
    }
  }, [roomSnapshots, positionedRooms])

  const selectedRoomData = useMemo(() => {
    if (!selectedRoomNumber) return null
    const snap = roomSnapshots.find((s) => s.roomNumber === selectedRoomNumber)
    return {
      number: selectedRoomNumber,
      occupied: snap?.occupied ?? 0,
      capacity: 4,
      students: snap?.students ?? []
    }
  }, [selectedRoomNumber, roomSnapshots])

  const renderBlockColumn = (side: RoomBlockSide, blocks: EditableBlock[]) => (
    <div className={`rounded-2xl border p-4 ${cardBg}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-xs font-black uppercase tracking-wider ${textStrong}`}>
          {side === 'left' ? 'Chap tomon' : "O'ng tomon"}
        </h3>
        <span className={`text-[10px] font-bold ${textMuted}`}>{blocks.length} ta xona</span>
      </div>

      <div className="space-y-2">
        {blocks.map((block, index) => (
          <div key={index} className={`rounded-xl border p-2.5 space-y-2 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.02]'}`}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={block.roomNumber}
                onChange={(e) => updateBlock(side, index, { roomNumber: e.target.value })}
                placeholder="Xona №"
                className={`min-w-0 flex-1 text-xs py-1.5 px-2.5 rounded-lg outline-none border ${inputBg}`}
              />
              <button onClick={() => moveBlock(side, index, -1)} disabled={index === 0} className={`p-1.5 rounded-lg disabled:opacity-30 ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'} ${textMuted}`}>
                <ChevronUp size={14} />
              </button>
              <button onClick={() => moveBlock(side, index, 1)} disabled={index === blocks.length - 1} className={`p-1.5 rounded-lg disabled:opacity-30 ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'} ${textMuted}`}>
                <ChevronDown size={14} />
              </button>
              <button onClick={() => removeBlock(side, index)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex gap-1.5">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => updateBlock(side, index, { size })}
                  className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    block.size === size
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                      : isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'
                  }`}
                >
                  {SIZE_LABELS[size]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => addBlock(side)}
        className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed text-[10px] font-black uppercase tracking-wider transition-all ${
          isLight ? 'border-slate-300 text-slate-500 hover:bg-slate-100' : 'border-white/15 text-slate-400 hover:bg-white/5'
        }`}
      >
        <Plus size={14} /> Xona qo&apos;shish
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-400">
            <Layers3 className="h-4 w-4" />
            Qavat Tarxi Quruvchisi
          </div>
          <h1 className={`mt-4 text-3xl font-black tracking-tight sm:text-4xl ${textStrong}`}>
            Dynamic 3D Bino Modeli
          </h1>
          <p className={`mt-3 max-w-3xl text-sm leading-6 ${textMuted}`}>
            Har bir qavat uchun xonalarni chap va o&apos;ng tomonga, xohlagan tartibda va o&apos;lchamda qo&apos;shing — natija pastda jonli 3D maketda ko&apos;rinadi.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <div className={`flex items-center gap-2 ${textMuted}`}>
              <Users className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Band joy</span>
            </div>
            <p className={`mt-2 text-2xl font-black ${textStrong}`}>{summary.occupiedPlaces}</p>
          </div>
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <div className={`flex items-center gap-2 ${textMuted}`}>
              <DoorOpen className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Bo&apos;sh joy</span>
            </div>
            <p className={`mt-2 text-2xl font-black ${textStrong}`}>{summary.freePlaces}</p>
          </div>
          <div className={`rounded-xl border p-4 ${cardBg}`}>
            <div className={`flex items-center gap-2 ${textMuted}`}>
              <Layers3 className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Jami xona</span>
            </div>
            <p className={`mt-2 truncate text-2xl font-black ${textStrong}`}>{summary.totalRooms} ta</p>
          </div>
        </div>
      </div>

      {/* Floor Selection Tabs */}
      <div className="flex gap-2 p-1.5 rounded-2xl bg-slate-100/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 w-full overflow-x-auto no-scrollbar sm:w-fit">
        {floors.map((fl) => {
          const active = fl === activeFloor
          return (
            <button
              key={fl}
              onClick={() => {
                if (fl === activeFloor) return
                if (isDirty && !window.confirm(
                  `${activeFloor}-qavatda saqlanmagan o'zgarishlar bor. Ularni saqlamasdan boshqa qavatga o'tsangiz, o'zgarishlar yo'qoladi. Davom etilsinmi?`
                )) {
                  return
                }
                setActiveFloor(fl)
              }}
              className={`shrink-0 whitespace-nowrap px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                active
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
              }`}
            >
              <Layers3 size={14} className={active ? 'text-white' : 'text-cyan-500'} />
              {fl}-qavat
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className={`backdrop-blur-xl border rounded-[2rem] p-16 ${surfaceBg} flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" />
        </div>
      ) : (
        <>
          {/* Editor */}
          <div className={`backdrop-blur-xl border rounded-[2rem] p-6 ${surfaceBg}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className={`text-lg font-black ${textStrong}`}>{activeFloor}-qavat tarxi</h2>
                <p className={`text-xs mt-1 ${textMuted}`}>Zal ikki tomoni bo&apos;yicha xonalarni joylashtiring — lego kabi yig&apos;ing.</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => void loadFloorLayout(activeFloor)}
                  className={`p-2.5 rounded-xl border transition-all ${isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-white/10 hover:bg-white/5 text-slate-300'}`}
                  title="Saqlangan holatga qaytarish"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderBlockColumn('left', leftBlocks)}
              {renderBlockColumn('right', rightBlocks)}
            </div>
          </div>

          {/* 3D Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative min-h-[420px] rounded-[2rem] border backdrop-blur-xl overflow-hidden ${surfaceBg}`}
          >
            <div className="absolute top-6 left-6 z-10 flex flex-wrap gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>Bo&apos;sh</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>Qisman</span>
              </div>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>To&apos;la</span>
              </div>
            </div>

            {positionedRooms.rooms.length === 0 ? (
              <div className="h-[420px] flex flex-col items-center justify-center text-center px-6">
                <Building2 className={`h-10 w-10 mb-3 ${textMuted}`} />
                <p className={`text-sm font-bold ${textMuted}`}>Hali xona qo&apos;shilmagan — yuqoridan xona qo&apos;shing.</p>
              </div>
            ) : (
              <canvas ref={canvasRef} className="w-full h-[420px] block outline-none cursor-grab active:cursor-grabbing" />
            )}

            {hoveredRoom && typeof document !== 'undefined' && createPortal(
              (() => {
                const snap = roomSnapshots.find((s) => s.roomNumber === hoveredRoom.roomNumber)
                return (
                  <div
                    className={`pointer-events-none fixed z-[9999] rounded-xl border px-3 py-2 shadow-2xl backdrop-blur-xl ${isLight ? 'bg-white/95 border-slate-200' : 'bg-[#0b101d]/95 border-white/10'}`}
                    style={{ left: hoveredRoom.clientX + 14, top: hoveredRoom.clientY + 14, fontFamily: scopedFontFamily }}
                  >
                    <p className={`text-xs font-black ${textStrong}`}>Xona #{hoveredRoom.roomNumber}</p>
                    {snap && snap.students.length > 0 ? (
                      <p className={`mt-0.5 max-w-[220px] text-[10px] ${textMuted}`}>
                        {snap.students.map((s) => s.name).join(', ')}
                      </p>
                    ) : (
                      <p className={`mt-0.5 text-[10px] ${textMuted}`}>Bo&apos;sh</p>
                    )}
                  </div>
                )
              })(),
              document.body
            )}

            <div className="absolute bottom-6 left-6 pointer-events-none">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} flex items-center gap-2`}>
                <MousePointer2 size={12} />
                Aylantirish uchun sudrang, tanlash uchun xonani bosing.
              </p>
            </div>
          </motion.div>

          {/* Details Card for selected room */}
          <AnimatePresence mode="wait">
            {selectedRoomData && (
              <motion.div
                key={selectedRoomData.number}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`rounded-[2rem] border p-6 sm:p-8 backdrop-blur-2xl shadow-2xl ${surfaceBg}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Building2 size={24} />
                    </div>
                    <div className="min-w-0">
                      <h2 className={`text-2xl font-black tracking-tight truncate ${textStrong}`}>Xona #{selectedRoomData.number}</h2>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{activeFloor}-qavat</p>
                    </div>
                  </div>
                  <div className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border ${cardBg}`}>
                    <Info size={16} className="text-cyan-400" />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${textStrong}`}>Tafsilotlar</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Detail label="Xona raqami" value={`#${selectedRoomData.number}`} icon={<MousePointer2 size={16} />} textStrong={textStrong} cardBg={cardBg} />
                  <Detail
                    label="Bandlik holati"
                    value={`${selectedRoomData.occupied} / ${selectedRoomData.capacity}`}
                    icon={<Users size={16} />}
                    status={selectedRoomData.occupied >= 4 ? 'full' : selectedRoomData.occupied > 0 ? 'partial' : 'empty'}
                    textStrong={textStrong}
                    cardBg={cardBg}
                  />
                  <Detail
                    label="Bo'sh joylar"
                    value={`${selectedRoomData.capacity - selectedRoomData.occupied} ta`}
                    icon={<DoorOpen size={16} />}
                    textStrong={textStrong}
                    cardBg={cardBg}
                  />

                  {selectedRoomData.students.length > 0 && (
                    <div className="md:col-span-3">
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${textMuted}`}>Xonadagi Talabalar Ro&apos;yxati</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedRoomData.students.map((student) => (
                          <div key={student.id} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${cardBg}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 shrink-0 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold text-xs uppercase">
                                {student.name.slice(0, 2)}
                              </div>
                              <p className={`text-sm font-bold truncate ${textStrong}`}>{student.name}</p>
                            </div>
                            <Link
                              href={`/admin/foydalanuvchilar?id=${student.id}`}
                              className="shrink-0 p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-all border border-cyan-500/20"
                            >
                              <ExternalLink size={14} />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

function Detail({ label, value, icon, status, textStrong, cardBg }: { label: string; value: string; icon?: React.ReactNode; status?: 'empty' | 'partial' | 'full'; textStrong: string; cardBg: string }) {
  const statusColors = {
    empty: 'text-emerald-400',
    partial: 'text-amber-400',
    full: 'text-rose-400'
  }

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${cardBg} hover:bg-white/[0.08]`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-slate-500">{icon}</div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      </div>
      <p className={`text-2xl font-black ${status ? statusColors[status] : textStrong}`}>{value}</p>
    </div>
  )
}
