'use client'

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Building2, DoorOpen, Layers3, Users,
  Info, MousePointer2,
  Plus, Trash2, GripVertical, Save, RotateCcw
} from 'lucide-react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useThemeStore } from '@/lib/stores/theme-store'
import { useScopedFontFamily } from '@/lib/font-scope-context'
import toast from 'react-hot-toast'
import * as THREE from 'three'
import { fetchDekanOverview } from '@/features/permits/client/admin-api'
import { fetchFloorLayout, saveFloorLayout } from '@/features/room-layout/client/api'
import type { RoomBlockSide, RoomBlockSize, RoomLayoutBlock } from '@/features/room-layout/types'
import { fetchAppSettings } from '@/features/app-settings/client/api'
import { getFreePlaces, getRoomOccupancyTone, type RoomOccupancyTone } from '@/features/app-settings/presentation'
import { dekanUI } from '@/lib/dekan-ui'

interface StudentInfo {
  id: string
  name: string
}

interface RoomOccupancySnapshot {
  roomNumber: string
  occupied: number
  students: StudentInfo[]
}

type EditableBlock = { id: string; roomNumber: string; size: RoomBlockSize }

// Reorder.Item needs a key that stays put while the room number is edited
// (it can be blank or briefly duplicated mid-typing), so every row carries
// a client-only id that is never sent to the server.
const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)

// Next room number = one past the highest number already in the column, so
// "+5" fills 17,18,19,20,21 rather than five blank rows.
const nextRoomNumber = (blocks: EditableBlock[]) => {
  const nums = blocks.map((b) => parseInt(b.roomNumber, 10)).filter((n) => Number.isFinite(n))
  return nums.length ? Math.max(...nums) + 1 : null
}

// The id is a per-session render key, never persisted — only room number,
// order and size decide whether the floor has unsaved edits.
const snapshotBlocks = (left: EditableBlock[], right: EditableBlock[]) => {
  const strip = (list: EditableBlock[]) => list.map(({ roomNumber, size }) => ({ roomNumber, size }))
  return JSON.stringify({ left: strip(left), right: strip(right) })
}

const SIZE_RANK: Record<RoomBlockSize, number> = { small: 1, medium: 2, large: 3 }
const SIZE_CYCLE: RoomBlockSize[] = ['small', 'medium', 'large']
const TONE_DOT: Record<RoomOccupancyTone, string> = {
  empty: 'bg-emerald-500',
  partial: 'bg-amber-500',
  full: 'bg-rose-500',
  unknown: 'bg-slate-400',
}

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

// Moved here from app/admin/3d-xonalar — dekan now owns the floor-plan
// builder exclusively, admin and tarbiyachi no longer have it. Room
// occupancy comes from fetchDekanOverview() (already faculty-redacted —
// a cross-faculty occupant's name/id come back blank) rather than the
// admin-only, building-wide student list the old page used, since physical
// room capacity is building-wide even though student identity isn't.
export default function Dekan3DXonalarPage() {
  const [roomSnapshots, setRoomSnapshots] = useState<RoomOccupancySnapshot[]>([])
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string | null>(null)
  const [hoveredRoom, setHoveredRoom] = useState<{ roomNumber: string; clientX: number; clientY: number } | null>(null)

  const [activeFloor, setActiveFloor] = useState<number>(1)
  // null (not a guessed default) while settings are loading or unavailable —
  // a wrong guess would silently hide real floors above it from the tab list.
  const [floorCount, setFloorCount] = useState<number | null>(null)
  // null (not a guessed default) while settings are loading or unavailable —
  // a wrong guess would color a room "full" or compute free places against a
  // capacity that isn't the real one.
  const [defaultRoomCapacity, setDefaultRoomCapacity] = useState<number | null>(null)
  const [settingsStatus, setSettingsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const floors = floorCount ? Array.from({ length: floorCount }, (_, i) => i + 1) : []

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leftBlocks, setLeftBlocks] = useState<EditableBlock[]>([])
  const [rightBlocks, setRightBlocks] = useState<EditableBlock[]>([])
  // Phones show one side at a time (segmented switch); md+ shows both columns.
  const [mobileSide, setMobileSide] = useState<RoomBlockSide>('left')
  // Floor the dekan wants to switch to while the current one has unsaved
  // edits — drives the "discard changes?" confirm modal.
  const [pendingFloor, setPendingFloor] = useState<number | null>(null)
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

  const ui = dekanUI(isLight)
  const surfaceBg = ui.card
  const cardBg = ui.inset
  const textMuted = ui.muted
  const textStrong = ui.strong
  const inputBg = ui.input

  const loadRoomOccupancy = useCallback(async () => {
    try {
      const { usersWithRooms, approvedPermitsWithRooms } = await fetchDekanOverview()
      const occupancyMap = new Map<string, { count: number, students: StudentInfo[] }>()

      const addOccupant = (roomNumber: string | null, id: string | null, name: string | null) => {
        if (!roomNumber) return
        const existing = occupancyMap.get(roomNumber) || { count: 0, students: [] }
        occupancyMap.set(roomNumber, {
          count: existing.count + 1,
          students: [...existing.students, { id: id ?? '', name: name || 'Noma\'lum' }],
        })
      }

      usersWithRooms?.forEach((u) => addOccupant(u.room_number, u.id, u.full_name))
      // Approved-but-not-yet-registered permits occupy a bed too — counted
      // the same way dekan/xonalar counts them, so capacity/occupancy here
      // matches what that page shows.
      approvedPermitsWithRooms?.forEach((p) => addOccupant(p.room_number, p.id, p.full_name))

      setRoomSnapshots(
        Array.from(occupancyMap.entries()).map(([roomNumber, info]) => ({
          roomNumber,
          occupied: info.count,
          students: info.students,
        }))
      )
    } catch (error) {
      console.error('Xona bandligini yuklashda xato:', error)
      toast.error('Bandlik ma\'lumotlarini yuklashda xatolik yuz berdi')
    }
  }, [])

  const loadFloorLayout = async (floor: number) => {
    setLoading(true)
    setSelectedRoomNumber(null)
    try {
      const blocks = await fetchFloorLayout(floor)
      const left = blocks.filter((b) => b.side === 'left').map((b) => ({ id: makeId(), roomNumber: b.roomNumber, size: b.size }))
      const right = blocks.filter((b) => b.side === 'right').map((b) => ({ id: makeId(), roomNumber: b.roomNumber, size: b.size }))
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
  }, [loadRoomOccupancy])

  const loadSettings = useCallback(async () => {
    setSettingsStatus('loading')
    try {
      const settings = await fetchAppSettings()
      setFloorCount(settings.floorCount)
      setDefaultRoomCapacity(settings.defaultRoomCapacity)
      setSettingsStatus('ready')
    } catch {
      setFloorCount(null)
      setDefaultRoomCapacity(null)
      setSettingsStatus('error')
      toast.error("Xona va qavat sozlamalarini yuklab bo'lmadi")
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

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
  const setSide = (side: RoomBlockSide) => (side === 'left' ? setLeftBlocks : setRightBlocks)

  const addBlock = (side: RoomBlockSide, count = 1) => {
    setSide(side)((prev) => {
      const start = nextRoomNumber(prev)
      const additions: EditableBlock[] = Array.from({ length: count }, (_, i) => ({
        id: makeId(),
        roomNumber: start === null ? '' : String(start + i),
        size: 'medium',
      }))
      return [...prev, ...additions]
    })
  }
  const updateBlock = (side: RoomBlockSide, id: string, patch: Partial<EditableBlock>) => {
    setSide(side)((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }
  const removeBlock = (side: RoomBlockSide, id: string) => {
    setSide(side)((prev) => prev.filter((b) => b.id !== id))
  }
  const reorderSide = (side: RoomBlockSide, orderedIds: string[]) => {
    setSide(side)((prev) => {
      const byId = new Map(prev.map((b) => [b.id, b]))
      const next = orderedIds.map((id) => byId.get(id)).filter((b): b is EditableBlock => Boolean(b))
      return next.length === prev.length ? next : prev
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
    const dirLight2 = new THREE.DirectionalLight(0x6366f1, 0.4)
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
    const slabLineMat = new THREE.LineBasicMaterial({ color: isLight ? 0x94a3b8 : 0x475569 })
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
      const occupancyTone = getRoomOccupancyTone(occupied, defaultRoomCapacity)

      const color = {
        empty: 0x10b981,
        partial: 0xf59e0b,
        full: 0xef4444,
        unknown: 0x64748b,
      }[occupancyTone]

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
  }, [positionedRooms, roomSnapshots, isLight, defaultRoomCapacity])

  const summary = useMemo(() => {
    const roomCount = positionedRooms.rooms.length
    const occupiedPlaces = roomSnapshots
      .filter((room) => positionedRooms.rooms.some((r) => r.roomNumber === room.roomNumber))
      .reduce((total, room) => total + room.occupied, 0)
    return {
      occupiedPlaces,
      totalRooms: roomCount,
      freePlaces: getFreePlaces(
        defaultRoomCapacity === null ? null : roomCount * defaultRoomCapacity,
        occupiedPlaces,
      ),
    }
  }, [roomSnapshots, positionedRooms, defaultRoomCapacity])

  const selectedRoomData = useMemo(() => {
    if (!selectedRoomNumber) return null
    const snap = roomSnapshots.find((s) => s.roomNumber === selectedRoomNumber)
    return {
      number: selectedRoomNumber,
      occupied: snap?.occupied ?? 0,
      capacity: defaultRoomCapacity,
      students: snap?.students ?? []
    }
  }, [selectedRoomNumber, roomSnapshots, defaultRoomCapacity])

  const quickAddBtn = isLight
    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    : 'bg-white/5 text-slate-300 hover:bg-white/10'

  const renderColumn = (side: RoomBlockSide, blocks: EditableBlock[]) => {
    const filledCount = blocks.filter((b) => b.roomNumber.trim()).length
    const places = defaultRoomCapacity === null ? null : filledCount * defaultRoomCapacity
    return (
      <div className={`rounded-2xl border p-3 ${cardBg}`}>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <h3 className={`text-xs font-bold uppercase tracking-wider ${textStrong}`}>
            {side === 'left' ? 'Chap tomon' : "O'ng tomon"}
          </h3>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold tabular-nums ${textMuted}`}>
              {filledCount} ta{places !== null ? ` · ${places} joy` : ''}
            </span>
            <button type="button" onClick={() => addBlock(side, 1)} className={`flex items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-bold ${quickAddBtn}`}>
              <Plus size={11} /> 1
            </button>
            <button type="button" onClick={() => addBlock(side, 5)} className={`flex items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-bold ${quickAddBtn}`}>
              <Plus size={11} /> 5
            </button>
          </div>
        </div>

        {blocks.length === 0 ? (
          <p className={`py-5 text-center text-[11px] font-medium ${textMuted}`}>
            Xona yo&apos;q — <span className="font-bold">+1</span> yoki <span className="font-bold">+5</span> bosing.
          </p>
        ) : (
          <Reorder.Group
            axis="y"
            values={blocks.map((b) => b.id)}
            onReorder={(ids) => reorderSide(side, ids as string[])}
            className="space-y-1.5"
          >
            {blocks.map((block) => {
              const trimmed = block.roomNumber.trim()
              const snap = trimmed ? roomSnapshots.find((s) => s.roomNumber === trimmed) : undefined
              const occupied = snap?.occupied ?? 0
              const tone: RoomOccupancyTone = trimmed
                ? getRoomOccupancyTone(occupied, defaultRoomCapacity)
                : 'unknown'
              const occText = !trimmed
                ? ''
                : occupied === 0
                  ? "bo'sh"
                  : `${occupied}/${defaultRoomCapacity ?? '?'}`
              return (
                <RoomRow
                  key={block.id}
                  block={block}
                  isLight={isLight}
                  inputBg={inputBg}
                  textMuted={textMuted}
                  toneDot={trimmed ? TONE_DOT[tone] : isLight ? 'bg-slate-300' : 'bg-slate-600'}
                  occText={occText}
                  onNumber={(v) => updateBlock(side, block.id, { roomNumber: v })}
                  onCycleSize={() => updateBlock(side, block.id, { size: SIZE_CYCLE[SIZE_RANK[block.size] % 3] })}
                  onRemove={() => removeBlock(side, block.id)}
                />
              )
            })}
          </Reorder.Group>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${textStrong}`}>
            Qavat tarxi quruvchisi
          </h1>
          <p className={`mt-1 max-w-3xl text-xs sm:text-sm leading-6 ${textMuted}`}>
            Har bir qavat uchun xonalarni chap va o&apos;ng tomonga, xohlagan tartibda va o&apos;lchamda qo&apos;shing — natija pastda jonli 3D maketda ko&apos;rinadi.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
          {[
            { icon: Users, label: 'Band joy', value: summary.occupiedPlaces },
            { icon: DoorOpen, label: "Bo'sh joy", value: summary.freePlaces ?? '—' },
            { icon: Layers3, label: 'Jami xona', value: `${summary.totalRooms} ta` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className={`rounded-xl border p-4 ${cardBg}`}>
              <div className={`flex items-center gap-2 ${textMuted}`}>
                <Icon className={`h-4 w-4 ${ui.accentText}`} />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</span>
              </div>
              <p className={`mt-2 truncate text-2xl font-bold ${textStrong}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Floor Selection Tabs */}
      <div className={`flex gap-1 p-1 rounded-xl ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'} w-full overflow-x-auto no-scrollbar sm:w-fit`}>
        {floors.map((fl) => {
          const active = fl === activeFloor
          return (
            <button
              key={fl}
              onClick={() => {
                if (fl === activeFloor) return
                // Saqlanmagan o'zgarishlar bo'lsa — brauzer alert'i emas, modal.
                if (isDirty) {
                  setPendingFloor(fl)
                  return
                }
                setActiveFloor(fl)
              }}
              className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${
                active
                  ? 'bg-indigo-600 text-white'
                  : `${ui.muted} ${isLight ? 'hover:text-slate-800' : 'hover:text-slate-200'}`
              }`}
            >
              <Layers3 size={14} className={active ? 'text-white' : 'text-indigo-500'} />
              {fl}-qavat
            </button>
          )
        })}
      </div>

      {settingsStatus === 'error' && (
        <div className={`flex flex-col gap-3 rounded-2xl border p-4 text-xs sm:flex-row sm:items-center sm:justify-between ${
          isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'
        }`}>
          <span>Xona sig&apos;imi va qavatlar sonini yuklab bo&apos;lmadi. Sig&apos;imga bog&apos;liq statuslar noma&apos;lum deb ko&apos;rsatilmoqda.</span>
          <button
            type="button"
            onClick={() => void loadSettings()}
            className={`shrink-0 rounded-lg px-3 py-2 font-bold uppercase tracking-wider ${ui.dangerSoft}`}
          >
            Qayta urinish
          </button>
        </div>
      )}

      {loading ? (
        <div className={`backdrop-blur-xl border rounded-2xl p-16 ${surfaceBg} flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700" />
        </div>
      ) : (
        <>
          {/* Editor */}
          <div className={`backdrop-blur-xl border rounded-2xl p-6 ${surfaceBg}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className={`text-lg font-bold ${textStrong}`}>{activeFloor}-qavat tarxi</h2>
                <p className={`text-xs mt-1 ${textMuted}`}>+1 / +5 bilan xona qo&apos;shing, qatorni sudrab tartiblang, o&apos;lcham uchun pillni bosing.</p>
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
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  <Save size={14} /> {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
              </div>
            </div>

            {/* Phones: one side at a time via a segment. md+: both columns. */}
            <div className={`md:hidden flex gap-1 p-1 rounded-xl mb-3 ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`}>
              {(['left', 'right'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMobileSide(s)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    mobileSide === s ? 'bg-indigo-600 text-white' : textMuted
                  }`}
                >
                  {s === 'left' ? 'Chap' : "O'ng"} tomon
                </button>
              ))}
            </div>
            <div className="md:hidden">
              {renderColumn(mobileSide, mobileSide === 'left' ? leftBlocks : rightBlocks)}
            </div>
            <div className="hidden md:grid md:grid-cols-2 gap-4">
              {renderColumn('left', leftBlocks)}
              {renderColumn('right', rightBlocks)}
            </div>
          </div>

          {/* 3D Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative min-h-[420px] rounded-2xl border backdrop-blur-xl overflow-hidden ${surfaceBg}`}
          >
            <div className="absolute top-6 left-6 z-10 flex flex-wrap gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>Bo&apos;sh</span>
              </div>
              {defaultRoomCapacity === null ? (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>Sig&apos;im noma&apos;lum</span>
                </div>
              ) : (
                <>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>Qisman</span>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cardBg}`}>
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${textStrong}`}>To&apos;la</span>
                  </div>
                </>
              )}
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
                    className={`pointer-events-none fixed z-[9999] rounded-xl border px-3 py-2 shadow-2xl backdrop-blur-xl ${isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-slate-800'}`}
                    style={{ left: hoveredRoom.clientX + 14, top: hoveredRoom.clientY + 14, fontFamily: scopedFontFamily }}
                  >
                    <p className={`text-xs font-bold ${textStrong}`}>Xona #{hoveredRoom.roomNumber}</p>
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
                className={`rounded-2xl border p-6 sm:p-8 backdrop-blur-2xl shadow-2xl ${surfaceBg}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                      <Building2 size={24} />
                    </div>
                    <div className="min-w-0">
                      <h2 className={`text-2xl font-bold tracking-tight truncate ${textStrong}`}>Xona #{selectedRoomData.number}</h2>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{activeFloor}-qavat</p>
                    </div>
                  </div>
                  <div className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border ${cardBg}`}>
                    <Info size={16} className="text-indigo-500" />
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${textStrong}`}>Tafsilotlar</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Detail label="Xona raqami" value={`#${selectedRoomData.number}`} icon={<MousePointer2 size={16} />} textStrong={textStrong} cardBg={cardBg} />
                  <Detail
                    label="Bandlik holati"
                    value={`${selectedRoomData.occupied} / ${selectedRoomData.capacity ?? '?'}`}
                    icon={<Users size={16} />}
                    status={getRoomOccupancyTone(selectedRoomData.occupied, selectedRoomData.capacity)}
                    textStrong={textStrong}
                    cardBg={cardBg}
                  />
                  <Detail
                    label="Bo'sh joylar"
                    value={selectedRoomData.capacity === null
                      ? "Noma'lum"
                      : `${getFreePlaces(selectedRoomData.capacity, selectedRoomData.occupied)} ta`}
                    icon={<DoorOpen size={16} />}
                    textStrong={textStrong}
                    cardBg={cardBg}
                  />

                  {selectedRoomData.students.length > 0 && (
                    <div className="md:col-span-3">
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${textMuted}`}>Xonadagi Talabalar Ro&apos;yxati</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedRoomData.students.map((student, i) => (
                          <div key={student.id || `${selectedRoomData.number}-${i}`} className={`p-4 rounded-2xl border flex items-center gap-3 ${cardBg}`}>
                            <div className="w-8 h-8 shrink-0 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs uppercase">
                              {student.name.slice(0, 2)}
                            </div>
                            <p className={`text-sm font-bold truncate ${textStrong}`}>{student.name}</p>
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

      <ConfirmModal
        isOpen={pendingFloor !== null}
        title="Saqlanmagan o'zgarishlar"
        description={`${activeFloor}-qavat tarxida saqlanmagan o'zgarishlar bor.`}
        confirmText={`${pendingFloor ?? ''}-qavatga o'tish`}
        cancelText="Bu qavatda qolish"
        confirmVariant="danger"
        onClose={() => setPendingFloor(null)}
        onConfirm={() => {
          if (pendingFloor !== null) setActiveFloor(pendingFloor)
          setPendingFloor(null)
        }}
      >
        <p className={textMuted}>
          Boshqa qavatga o&apos;tsangiz, bu qavatdagi o&apos;zgarishlar saqlanmaydi va yo&apos;qoladi.
          Avval <span className="font-bold">Saqlash</span> tugmasini bosing yoki o&apos;zgarishlarni bekor qiling.
        </p>
      </ConfirmModal>
    </div>
  )
}

// One compact editor row (~36px): drag handle · number · size pill · live
// occupancy dot · delete. Kept module-level so its useDragControls hook
// isn't recreated on every parent render (which would kill the drag).
function RoomRow({
  block, isLight, inputBg, textMuted, toneDot, occText, onNumber, onCycleSize, onRemove,
}: {
  block: EditableBlock
  isLight: boolean
  inputBg: string
  textMuted: string
  toneDot: string
  occText: string
  onNumber: (value: string) => void
  onCycleSize: () => void
  onRemove: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={block.id}
      dragListener={false}
      dragControls={controls}
      className={`flex items-center gap-1.5 rounded-lg border pl-0.5 pr-1 h-9 ${
        isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        className={`shrink-0 touch-none cursor-grab active:cursor-grabbing px-0.5 ${textMuted}`}
        aria-hidden
      >
        <GripVertical size={14} />
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={block.roomNumber}
        onChange={(e) => onNumber(e.target.value)}
        placeholder="№"
        className={`w-11 sm:w-12 shrink-0 text-xs text-center py-1 rounded-md outline-none border ${inputBg}`}
      />
      <button
        type="button"
        onClick={onCycleSize}
        title="O'lchamni o'zgartirish"
        className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 h-7 rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors ${
          isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
        }`}
      >
        <span className="flex items-end gap-[2px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-[3px] rounded-[1px] bg-current"
              style={{ height: 5 + i * 3, opacity: i < SIZE_RANK[block.size] ? 1 : 0.28 }}
            />
          ))}
        </span>
        {SIZE_LABELS[block.size]}
      </button>
      <span className="shrink-0 flex items-center justify-end gap-1 w-[52px]">
        <span className={`h-2 w-2 rounded-full ${toneDot}`} />
        <span className={`text-[9px] font-semibold tabular-nums ${textMuted}`}>{occText}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 p-1 rounded-md text-rose-500 hover:bg-rose-500/10 dark:text-rose-400"
        aria-label="O'chirish"
      >
        <Trash2 size={13} />
      </button>
    </Reorder.Item>
  )
}

function Detail({ label, value, icon, status, textStrong, cardBg }: { label: string; value: string; icon?: React.ReactNode; status?: RoomOccupancyTone; textStrong: string; cardBg: string }) {
  const statusColors: Record<RoomOccupancyTone, string> = {
    empty: 'text-emerald-600 dark:text-emerald-400',
    partial: 'text-amber-600 dark:text-amber-400',
    full: 'text-rose-600 dark:text-rose-400',
    unknown: 'text-slate-500 dark:text-slate-400',
  }

  return (
    <div className={`rounded-xl border p-5 ${cardBg}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-slate-400">{icon}</div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${status ? statusColors[status] : textStrong}`}>{value}</p>
    </div>
  )
}
