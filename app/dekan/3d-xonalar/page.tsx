'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import {
  DoorOpen, Layers3, Users,
  ArrowLeft, ArrowRight,
  Plus, Trash2, GripVertical, ChevronDown, Save, RotateCcw,
  CheckCircle2, Percent, Building2,
} from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Skel } from '@/components/ui/skeletons'
import { useThemeStore } from '@/lib/stores/theme-store'
import RoomScene3D, { type SceneRoom } from '@/components/dekan/RoomScene3D'
import toast from 'react-hot-toast'
import { fetchDekanOverview } from '@/features/permits/client/admin-api'
import { fetchFloorLayout, saveFloorLayout } from '@/features/room-layout/client/api'
import type { RoomBlockSide, RoomBlockSize, RoomLayoutBlock } from '@/features/room-layout/types'
import { fetchDekanDorm } from '@/features/dorms/client/api'
import type { DekanDorm } from '@/features/dorms/types'
import { fetchDekanSettings } from '@/features/app-settings/client/api'
import { getFreePlaces, getRoomOccupancyTone, type RoomOccupancyTone } from '@/features/app-settings/presentation'
import { dekanUI } from '@/lib/dekan-ui'
import { useStaffPanel } from '@/lib/hooks/useStaffPanel'

interface StudentInfo {
  id: string
  name: string
}

interface RoomOccupancySnapshot {
  roomNumber: string
  occupied: number
  students: StudentInfo[]
}

type EditableBlock = { id: string; roomNumber: string; size: RoomBlockSize; capacity: number | null; frozen: boolean }

// Compact capacity picker options in the row: "Standart" (null = inherit
// dorms.default_room_capacity) plus the realistic exception sizes.
const CAPACITY_CHOICES: (number | null)[] = [null, 1, 2, 3, 4, 5, 6, 8]

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
  const strip = (list: EditableBlock[]) =>
    list.map(({ roomNumber, size, capacity }) => ({ roomNumber, size, capacity }))
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
  capacity: number | null
  frozen: boolean
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
      return { roomNumber: b.roomNumber.trim(), size: b.size, capacity: b.capacity, frozen: b.frozen, z, ...units }
    })

  const totalDepth = Math.max(cursor - GAP, 0)
  const centerOffset = totalDepth / 2
  const maxWidth = raw.reduce((max, r) => Math.max(max, r.width), 0)
  const xSign = side === 'left' ? -1 : 1

  const rooms: PositionedRoom[] = raw.map((r) => ({
    roomNumber: r.roomNumber,
    side,
    size: r.size,
    capacity: r.capacity,
    frozen: r.frozen,
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

  // Every building this faculty holds (many-to-many, 202609300000), and
  // which one this page is currently pointed at — undefined = primary.
  // dormsLoaded stays separate from an empty `dorms` array so occupancy
  // isn't filtered before the primary dorm has actually resolved.
  const [dorms, setDorms] = useState<DekanDorm[]>([])
  const [dormsLoaded, setDormsLoaded] = useState(false)
  const [activeDormId, setActiveDormId] = useState<string | undefined>(undefined)
  const primaryDormId = dorms.find((d) => d.isPrimary)?.dormId

  const [activeFloor, setActiveFloor] = useState<number>(1)
  // null (not a guessed default) while settings are loading or unavailable —
  // a wrong guess would silently hide real floors above it from the tab list.
  const [floorCount, setFloorCount] = useState<number | null>(null)
  // null (not a guessed default) while settings are loading or unavailable —
  // a wrong guess would color a room "full" or compute free places against a
  // capacity that isn't the real one.
  const [defaultRoomCapacity, setDefaultRoomCapacity] = useState<number | null>(null)
  const [settingsStatus, setSettingsStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  // In a SHARED building a dekan only builds on the floors they actually hold —
  // never sees (or renumbers) another faculty's floors. Sole-faculty buildings
  // keep the full 1..floorCount range.
  const activeDorm = dorms.find((d) => (activeDormId ?? primaryDormId) === d.dormId)
  const floors = (() => {
    if ((activeDorm?.coFaculties.length ?? 0) > 0) {
      return activeDorm!.floors
        .filter((f) => f.state === 'mine' || f.state === 'mine_pending')
        .map((f) => f.floor)
    }
    return floorCount ? Array.from({ length: floorCount }, (_, i) => i + 1) : []
  })()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leftBlocks, setLeftBlocks] = useState<EditableBlock[]>([])
  const [rightBlocks, setRightBlocks] = useState<EditableBlock[]>([])
  // Phones show one side at a time (segmented switch); md+ shows both columns.
  const [mobileSide, setMobileSide] = useState<RoomBlockSide>('left')
  // Floor the dekan wants to switch to while the current one has unsaved
  // edits — drives the "discard changes?" confirm modal.
  const [pendingFloor, setPendingFloor] = useState<number | null>(null)
  // Same, but for switching to a different building's floor tarxi.
  const [pendingDormId, setPendingDormId] = useState<string | null>(null)
  // Which column's "ommaviy sig'im" panel is open; range bounds for it.
  const [capPanelSide, setCapPanelSide] = useState<RoomBlockSide | null>(null)
  const [capRange, setCapRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
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

  // Switching building triggers a floor clamp (line ~355), so two
  // loadFloorLayout calls can be in flight at once (the old floor, then the
  // clamped one). Without this guard the slower response wins and the tab
  // shows another floor's rooms — e.g. AMIT opening dorm-3 saw floor 1's
  // "1,2,3,3a…" under the "2-qavat" tab.
  const layoutReqSeq = useRef(0)

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const ui = dekanUI(isLight)
  // The tarbiyachi panel renders this same 3D floor view without the
  // block editor or Save — a pure viewer.
  const { readOnly } = useStaffPanel()
  const surfaceBg = ui.card
  const textMuted = ui.muted
  const textStrong = ui.strong

  const loadRoomOccupancy = useCallback(async () => {
    try {
      const { usersWithRooms, approvedPermitsWithRooms } = await fetchDekanOverview()
      const occupancyMap = new Map<string, { count: number, students: StudentInfo[] }>()

      // Room numbers are only unique per building (many-to-many,
      // 202609300000) — without this, two buildings sharing a room number
      // would merge their occupants under one snapshot. A row's dorm_id is
      // null for legacy data written before the multi-dorm migration —
      // treated as belonging to the primary building.
      const viewingDormId = activeDormId ?? primaryDormId
      const belongsToView = (rowDormId: string | null | undefined) => (rowDormId ?? primaryDormId) === viewingDormId

      const addOccupant = (roomNumber: string | null, id: string | null, name: string | null) => {
        if (!roomNumber) return
        const existing = occupancyMap.get(roomNumber) || { count: 0, students: [] }
        occupancyMap.set(roomNumber, {
          count: existing.count + 1,
          students: [...existing.students, { id: id ?? '', name: name || 'Noma\'lum' }],
        })
      }

      usersWithRooms?.forEach((u) => { if (belongsToView(u.dorm_id)) addOccupant(u.room_number, u.id, u.full_name) })
      // Approved-but-not-yet-registered permits occupy a bed too — counted
      // the same way dekan/xonalar counts them, so capacity/occupancy here
      // matches what that page shows.
      approvedPermitsWithRooms?.forEach((p) => { if (belongsToView(p.dorm_id)) addOccupant(p.room_number, p.id, p.full_name) })

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
  }, [activeDormId, primaryDormId])

  const loadFloorLayout = async (floor: number) => {
    const reqId = ++layoutReqSeq.current
    setLoading(true)
    try {
      const blocks = await fetchFloorLayout(floor, activeDormId)
      if (reqId !== layoutReqSeq.current) return // a newer load has superseded this one
      const toEditable = (b: (typeof blocks)[number]): EditableBlock => ({
        id: makeId(),
        roomNumber: b.roomNumber,
        size: b.size,
        capacity: b.capacity ?? null,
        frozen: b.frozen ?? false,
      })
      const left = blocks.filter((b) => b.side === 'left').map(toEditable)
      const right = blocks.filter((b) => b.side === 'right').map(toEditable)
      setLeftBlocks(left)
      setRightBlocks(right)
      setLastSavedSnapshot(snapshotBlocks(left, right))
    } catch (error) {
      if (reqId !== layoutReqSeq.current) return
      console.error('Qavat tarxini yuklashda xato:', error)
      toast.error('Qavat tarxini yuklab bo\'lmadi')
      setLeftBlocks([])
      setRightBlocks([])
      setLastSavedSnapshot(snapshotBlocks([], []))
    } finally {
      if (reqId === layoutReqSeq.current) setLoading(false)
    }
  }

  useEffect(() => {
    // Wait for the dorm request to resolve first — otherwise this runs once
    // with primaryDormId still undefined (silently dropping every row that
    // carries a real dorm_id), then again once it arrives.
    if (!dormsLoaded) return
    const loadId = window.setTimeout(() => void loadRoomOccupancy(), 0)
    return () => window.clearTimeout(loadId)
  }, [loadRoomOccupancy, dormsLoaded])

  const loadSettings = useCallback(async () => {
    setSettingsStatus('loading')
    try {
      const settings = await fetchDekanSettings(activeDormId)
      setFloorCount(settings.floorCount)
      setDefaultRoomCapacity(settings.defaultRoomCapacity)
      setSettingsStatus('ready')
    } catch {
      setFloorCount(null)
      setDefaultRoomCapacity(null)
      setSettingsStatus('error')
      toast.error("Xona va qavat sozlamalarini yuklab bo'lmadi")
    }
  }, [activeDormId])

  // Gated on dormsLoaded so a ?dormId= deep link (read below) is applied
  // BEFORE the first settings/layout fetch, not fetched-then-refetched.
  useEffect(() => {
    if (!dormsLoaded) return
    void loadSettings()
  }, [loadSettings, dormsLoaded])

  // Every building this faculty holds, and honor a deep link from the
  // Sozlamalar qavat menejeri: /dekan/3d-xonalar?floor=3&dormId=...
  useEffect(() => {
    fetchDekanDorm()
      .then((result) => {
        // A blocked-layout building's rooms are the fixed 9-per-section
        // template (dorm_build_blocked_layout) — not drawn here.
        const simple = result.dorms.filter((d) => d.layoutKind !== 'blocked')
        setDorms(simple)
        const wanted = new URLSearchParams(window.location.search).get('dormId')
        if (wanted && simple.some((d) => d.dormId === wanted)) {
          setActiveDormId(wanted)
        }
      })
      .catch((err) => console.error('Yotoqxonalar ro\'yxatini yuklashda xato:', err))
      .finally(() => setDormsLoaded(true))
  }, [])

  // ?floor= is read once on mount (client-only, so no Suspense boundary
  // needed) — independent of the dorm resolution above.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('floor')
    const floor = raw ? parseInt(raw, 10) : NaN
    if (Number.isInteger(floor) && floor >= 1 && floor <= 50) setActiveFloor(floor)
  }, [])

  // Keep the open floor inside the set this dekan may actually see — switching
  // to a shared building where they don't hold floor 1 must land on one they do.
  useEffect(() => {
    if (floors.length > 0 && !floors.includes(activeFloor)) setActiveFloor(floors[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors.join(','), activeDormId])

  useEffect(() => {
    if (!dormsLoaded) return
    // activeFloor is about to be clamped into `floors` by the effect above —
    // don't fetch (and race) a floor this dekan doesn't hold in this building.
    if (floors.length > 0 && !floors.includes(activeFloor)) return
    void loadFloorLayout(activeFloor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloor, activeDormId, dormsLoaded, floors.join(',')])

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
        capacity: null,
        frozen: false,
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

  // Send a room to the other side of the corridor — only its place in the 3D
  // layout changes, the room number / size / sig'im / muzlatilgan holat all
  // travel with it. Appended to the end of the target column; drag to reorder.
  const moveBlockToSide = (fromSide: RoomBlockSide, id: string) => {
    const fromList = fromSide === 'left' ? leftBlocks : rightBlocks
    const block = fromList.find((b) => b.id === id)
    if (!block) return
    const toSide: RoomBlockSide = fromSide === 'left' ? 'right' : 'left'
    setSide(fromSide)((prev) => prev.filter((b) => b.id !== id))
    setSide(toSide)((prev) => [...prev, block])
  }

  // Ommaviy sig'im: butun tomon, yoki xona raqami [from..to] oralig'idagilar.
  const applyColumnCapacity = (side: RoomBlockSide, capacity: number | null) => {
    setSide(side)((prev) => prev.map((b) => ({ ...b, capacity })))
    setCapPanelSide(null)
  }
  const applyRangeCapacity = (side: RoomBlockSide, capacity: number | null) => {
    const from = parseInt(capRange.from, 10)
    const to = parseInt(capRange.to, 10)
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      toast.error("Diapazon noto'g'ri (masalan 12–20)")
      return
    }
    setSide(side)((prev) =>
      prev.map((b) => {
        const n = parseInt(b.roomNumber, 10)
        return Number.isFinite(n) && n >= from && n <= to ? { ...b, capacity } : b
      }),
    )
    setCapPanelSide(null)
    setCapRange({ from: '', to: '' })
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
      ...filledLeft.map((b, i) => ({ roomNumber: b.roomNumber.trim(), side: 'left' as const, size: b.size, position: i, capacity: b.capacity })),
      ...filledRight.map((b, i) => ({ roomNumber: b.roomNumber.trim(), side: 'right' as const, size: b.size, position: i, capacity: b.capacity })),
    ]

    setSaving(true)
    try {
      await saveFloorLayout(activeFloor, combined, activeDormId)
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

  // Positioned rooms + live occupancy, shaped for the shared <RoomScene3D>.
  const sceneRooms: SceneRoom[] = useMemo(() =>
    positionedRooms.rooms.map((room) => {
      const snap = roomSnapshots.find((s) => s.roomNumber === room.roomNumber)
      return {
        roomNumber: room.roomNumber,
        x: room.x, z: room.z, width: room.width, depth: room.depth, height: room.height,
        frozen: room.frozen,
        capacity: room.capacity ?? defaultRoomCapacity,
        occupied: snap?.occupied ?? 0,
        occupants: snap?.students.map((st) => st.name) ?? [],
        isCapacityOverride: room.capacity != null,
      }
    }),
  [positionedRooms, roomSnapshots, defaultRoomCapacity])

  const summary = useMemo(() => {
    const roomCount = positionedRooms.rooms.length
    const liveRooms = positionedRooms.rooms.filter((r) => !r.frozen)
    const occupiedPlaces = roomSnapshots
      .filter((room) => liveRooms.some((r) => r.roomNumber === room.roomNumber))
      .reduce((total, room) => total + room.occupied, 0)
    // Total beds = sum of each non-frozen room's effective capacity
    // (override, else the dorm default). Frozen rooms are out of
    // circulation — their beds are neither "band" nor "bo'sh".
    const capacityUnknown = defaultRoomCapacity === null && liveRooms.some((r) => r.capacity === null)
    const totalBeds = capacityUnknown
      ? null
      : liveRooms.reduce((sum, r) => sum + (r.capacity ?? defaultRoomCapacity ?? 0), 0)
    const occPercent = totalBeds && totalBeds > 0 ? Math.min(100, Math.round((occupiedPlaces / totalBeds) * 100)) : 0
    return {
      occupiedPlaces,
      totalRooms: roomCount,
      frozenRooms: positionedRooms.rooms.length - liveRooms.length,
      freePlaces: getFreePlaces(totalBeds, occupiedPlaces),
      totalBeds,
      occPercent,
    }
  }, [roomSnapshots, positionedRooms, defaultRoomCapacity])

  const capLabel = (c: number | null) => (c === null ? 'Standart' : String(c))

  const renderColumn = (side: RoomBlockSide, blocks: EditableBlock[]) => {
    const filled = blocks.filter((b) => b.roomNumber.trim())
    const beds = filled.reduce((sum, b) => sum + (b.capacity ?? defaultRoomCapacity ?? 0), 0)
    const bedsKnown = defaultRoomCapacity !== null || filled.every((b) => b.capacity !== null)
    const panelOpen = capPanelSide === side
    return (
      <div className={`rounded-2xl border p-4 transition-all ${
        isLight ? 'bg-white border-slate-200/80 shadow-xs' : 'bg-slate-900/60 border-slate-800 shadow-md'
      }`}>
        <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
              side === 'left' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
            }`}>
              {side === 'left' ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
            </div>
            <div>
              <h3 className={`text-xs font-black uppercase tracking-wider ${textStrong}`}>
                {side === 'left' ? 'Chap tomon' : "O'ng tomon"}
              </h3>
              <p className={`text-[10px] font-bold tabular-nums ${textMuted}`}>
                {filled.length} ta xona{bedsKnown ? ` · ${beds} joy` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCapPanelSide(panelOpen ? null : side)}
              className={`no-shelf flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                panelOpen
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Ommaviy sig'im berish"
            >
              Sig&apos;im <ChevronDown size={11} className={panelOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            <button
              type="button"
              onClick={() => addBlock(side, 1)}
              className={`no-shelf flex items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                isLight ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50'
              }`}
              title="1 ta xona qo'shish"
            >
              <Plus size={11} /> 1
            </button>
            <button
              type="button"
              onClick={() => addBlock(side, 5)}
              className={`no-shelf flex items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
                isLight ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/50'
              }`}
              title="5 ta xona ketma-ket qo'shish"
            >
              <Plus size={11} /> 5
            </button>
          </div>
        </div>

        {panelOpen && (
          <div className={`mb-3 rounded-xl border p-3 space-y-2.5 text-[10px] shadow-xs ${
            isLight ? 'border-indigo-100 bg-indigo-50/60' : 'border-indigo-900/40 bg-indigo-950/30'
          }`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`font-bold uppercase tracking-wider ${textMuted}`}>Bu tomon hammasi:</span>
              {CAPACITY_CHOICES.map((c) => (
                <button
                  key={String(c)}
                  type="button"
                  onClick={() => applyColumnCapacity(side, c)}
                  className={`no-shelf rounded-md px-2 py-1 font-bold transition-colors ${
                    isLight ? 'bg-white text-slate-700 hover:bg-indigo-100 border border-slate-200/60 shadow-2xs' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-white/5'
                  }`}
                >
                  {capLabel(c)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`font-bold uppercase tracking-wider ${textMuted}`}>Oraliq №:</span>
              <input
                value={capRange.from}
                onChange={(e) => setCapRange((r) => ({ ...r, from: e.target.value.replace(/\D/g, '') }))}
                inputMode="numeric"
                placeholder="12"
                className={`w-12 text-center py-1 rounded-md outline-none border font-bold text-xs ${
                  isLight ? 'bg-white border-slate-200 focus:border-indigo-500' : 'bg-slate-800 border-slate-700 focus:border-indigo-500'
                }`}
              />
              <span className={textMuted}>–</span>
              <input
                value={capRange.to}
                onChange={(e) => setCapRange((r) => ({ ...r, to: e.target.value.replace(/\D/g, '') }))}
                inputMode="numeric"
                placeholder="20"
                className={`w-12 text-center py-1 rounded-md outline-none border font-bold text-xs ${
                  isLight ? 'bg-white border-slate-200 focus:border-indigo-500' : 'bg-slate-800 border-slate-700 focus:border-indigo-500'
                }`}
              />
              <span className={`font-bold uppercase tracking-wider ${textMuted}`}>→</span>
              {CAPACITY_CHOICES.map((c) => (
                <button
                  key={String(c)}
                  type="button"
                  onClick={() => applyRangeCapacity(side, c)}
                  className={`no-shelf rounded-md px-2 py-1 font-bold transition-colors ${
                    isLight ? 'bg-white text-slate-700 hover:bg-indigo-100 border border-slate-200/60 shadow-2xs' : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-white/5'
                  }`}
                >
                  {capLabel(c)}
                </button>
              ))}
            </div>
          </div>
        )}

        {blocks.length === 0 ? (
          <div className="py-8 text-center">
            <p className={`text-xs font-medium ${textMuted}`}>
              Xona yo&apos;q — yuqoridagi <span className="font-bold text-indigo-600 dark:text-indigo-400">+1</span> yoki <span className="font-bold text-indigo-600 dark:text-indigo-400">+5</span> tugmasini bosing.
            </p>
          </div>
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
              const effectiveCap = block.capacity ?? defaultRoomCapacity
              const tone: RoomOccupancyTone = trimmed
                ? getRoomOccupancyTone(occupied, effectiveCap)
                : 'unknown'
              const over = trimmed && effectiveCap !== null && occupied > effectiveCap
              const occText = !trimmed
                ? ''
                : block.frozen
                  ? 'muzlatilgan'
                  : occupied === 0
                    ? "bo'sh"
                    : `${occupied}/${effectiveCap ?? '?'}`
              return (
                <RoomRow
                  key={block.id}
                  block={block}
                  isLight={isLight}
                  textMuted={textMuted}
                  toneDot={block.frozen ? 'bg-cyan-500' : trimmed ? TONE_DOT[tone] : isLight ? 'bg-slate-300' : 'bg-slate-600'}
                  occText={occText}
                  over={Boolean(over)}
                  defaultCapacity={defaultRoomCapacity}
                  side={side}
                  onNumber={(v) => updateBlock(side, block.id, { roomNumber: v })}
                  onCycleSize={() => updateBlock(side, block.id, { size: SIZE_CYCLE[SIZE_RANK[block.size] % 3] })}
                  onCapacity={(c) => updateBlock(side, block.id, { capacity: c })}
                  onMoveSide={() => moveBlockToSide(side, block.id)}
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
    <div className="space-y-5">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-800 p-5 sm:p-6 text-white shadow-lg border border-white/20">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-48 w-48 rounded-full bg-indigo-500/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-inner">
              <Layers3 size={24} className="text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight" style={{ color: '#ffffff' }}>
                  {readOnly ? '3D Qavat maketi' : '3D Qavat tarxi quruvchisi'}
                </h1>
                {isDirty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Saqlanmagan o‘zgarishlar bor
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-white/10 text-emerald-300 border border-white/20">
                    <CheckCircle2 size={12} />
                    Saqlangan
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm font-medium mt-0.5" style={{ color: '#e0e7ff' }}>
                {activeDorm ? `${activeDorm.number}-yotoqxona` : 'Yotoqxona'} · {activeFloor}-qavat arxitekturasi va xonalar bandligi jonli 3D maketda
              </p>
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void loadFloorLayout(activeFloor)}
                className="no-shelf inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold transition-all hover:bg-white/20 active:scale-95"
                style={{ color: '#ffffff' }}
                title="Saqlangan holatga qaytarish"
              >
                <RotateCcw size={14} />
                <span>Qaytarish</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className={`no-shelf inline-flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 ${
                  isDirty
                    ? 'bg-amber-400 text-slate-900 hover:bg-amber-300 ring-2 ring-amber-400/40 shadow-amber-400/20'
                    : 'bg-white text-indigo-700 hover:bg-slate-100 disabled:opacity-60'
                }`}
              >
                <Save size={14} />
                <span>{saving ? 'Saqlanmoqda...' : 'Saqlash'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4-Metric KPI Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Users,
            label: 'Band o‘rinlar',
            value: `${summary.occupiedPlaces} ta`,
            sub: 'Talabalar joylashgan',
            accent: 'text-indigo-600 dark:text-indigo-400',
            bg: isLight ? 'bg-indigo-50/70 border-indigo-100' : 'bg-indigo-950/20 border-indigo-900/40',
          },
          {
            icon: DoorOpen,
            label: 'Bo‘sh joylar',
            value: summary.freePlaces !== null ? `${summary.freePlaces} ta` : '—',
            sub: 'Bo‘sh o‘rinlar soni',
            accent: 'text-emerald-600 dark:text-emerald-400',
            bg: isLight ? 'bg-emerald-50/70 border-emerald-100' : 'bg-emerald-950/20 border-emerald-900/40',
          },
          {
            icon: Layers3,
            label: 'Jami xonalar',
            value: `${summary.totalRooms} ta`,
            sub: summary.frozenRooms > 0 ? `${summary.frozenRooms} ta muzlatilgan` : 'Faol xonalar soni',
            accent: 'text-sky-600 dark:text-sky-400',
            bg: isLight ? 'bg-sky-50/70 border-sky-100' : 'bg-sky-950/20 border-sky-900/40',
          },
          {
            icon: Percent,
            label: 'Bandlik darajasi',
            value: `${summary.occPercent}%`,
            sub: `${summary.occupiedPlaces} / ${summary.totalBeds ?? '?'} o‘rin band`,
            accent: 'text-violet-600 dark:text-violet-400',
            bg: isLight ? 'bg-violet-50/70 border-violet-100' : 'bg-violet-950/20 border-violet-900/40',
          },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className={`flex items-center gap-3.5 rounded-2xl border p-3.5 shadow-xs transition-all ${item.bg}`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-2xs border border-slate-200/60 dark:border-slate-700/60 ${item.accent}`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${ui.faint}`}>
                  {item.label}
                </p>
                <p className={`truncate text-lg font-black leading-tight ${ui.strong}`}>
                  {item.value}
                </p>
                <p className={`truncate text-[10px] ${ui.muted}`}>
                  {item.sub}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Building & Floor Selector Bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-2.5 shadow-xs ${
        isLight ? 'bg-white border-slate-200/80' : 'bg-slate-900/60 border-slate-800'
      }`}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Building switcher (if > 1 dorm) */}
          {dorms.length > 1 && (
            <div className={`flex gap-1 rounded-xl p-1 border ${isLight ? 'bg-slate-100 border-slate-200/60' : 'bg-slate-800/60 border-white/5'}`}>
              {dorms.map((d) => {
                const isActive = (activeDormId ?? primaryDormId) === d.dormId
                return (
                  <button
                    key={d.dormId}
                    type="button"
                    onClick={() => {
                      if (isActive) return
                      if (isDirty) { setPendingDormId(d.dormId); return }
                      setActiveDormId(d.dormId)
                    }}
                    className={`no-shelf flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Building2 size={13} />
                    <span>{d.number}-yotoqxona{d.isPrimary ? ' (asosiy)' : ''}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Floor Selection Tabs */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {floors.map((fl) => {
              const active = fl === activeFloor
              return (
                <button
                  key={fl}
                  onClick={() => {
                    if (fl === activeFloor) return
                    if (isDirty) {
                      setPendingFloor(fl)
                      return
                    }
                    setActiveFloor(fl)
                  }}
                  className={`no-shelf shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isLight
                        ? 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <Layers3 size={13} className={active ? 'text-white' : 'text-indigo-500'} />
                  <span>{fl}-qavat</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-2">
          <span className={`text-[11px] font-bold ${ui.muted}`}>
            Xonalar soni: <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{summary.totalRooms} ta</span>
          </span>
        </div>
      </div>

      {settingsStatus === 'error' && (
        <div className={`flex flex-col gap-3 rounded-2xl border p-4 text-xs sm:flex-row sm:items-center sm:justify-between ${
          isLight ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'
        }`}>
          <span>Xona sig&apos;imi va qavatlar sonini yuklab bo&apos;lmadi. Sig&apos;imga bog&apos;liq statuslar noma&apos;lum deb ko&apos;rsatilmoqda.</span>
          <button
            type="button"
            onClick={() => void loadSettings()}
            className={`no-shelf shrink-0 rounded-lg px-3 py-2 font-bold uppercase tracking-wider ${ui.dangerSoft}`}
          >
            Qayta urinish
          </button>
        </div>
      )}

      {loading ? (
        <div className={`border rounded-2xl p-5 space-y-4 ${surfaceBg}`}>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skel key={i} className="h-9 w-24 rounded-xl" />
            ))}
          </div>
          <Skel className="h-[440px] w-full rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Editor — hidden in the tarbiyachi (view-only) panel */}
          {!readOnly && (
            <div className={`border rounded-2xl p-5 space-y-4 shadow-sm ${
              isLight ? 'bg-slate-50/50 border-slate-200/80' : 'bg-slate-900/40 border-slate-800'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className={`text-base font-black tracking-tight ${textStrong}`}>
                    {activeFloor}-qavat arxitekturasi va xonalar joylashuvi
                  </h2>
                  <p className={`text-xs mt-0.5 ${textMuted}`}>
                    Xonalarni sudrab tartiblang, o&apos;lcham va sig&apos;imni sozlang — o&apos;zgarishlar pastdagi 3D maketda aks etadi.
                  </p>
                </div>
              </div>

              {/* Phones: one side at a time via a segment. md+: both columns. */}
              <div className={`md:hidden flex gap-1 p-1 rounded-xl ${isLight ? 'bg-slate-100' : 'bg-slate-800/60'}`}>
                {(['left', 'right'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setMobileSide(s)}
                    className={`no-shelf flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                      mobileSide === s ? 'bg-indigo-600 text-white shadow-xs' : textMuted
                    }`}
                  >
                    {s === 'left' ? 'Chap' : "O'ng"} tomon ({s === 'left' ? leftBlocks.length : rightBlocks.length})
                  </button>
                ))}
              </div>

              <div className="md:hidden">
                {renderColumn(mobileSide, mobileSide === 'left' ? leftBlocks : rightBlocks)}
              </div>

              {/* Desktop: Side-by-side with central corridor metaphor */}
              <div className="hidden md:grid md:grid-cols-2 gap-4">
                {renderColumn('left', leftBlocks)}
                {renderColumn('right', rightBlocks)}
              </div>
            </div>
          )}

          {/* 3D Preview — shared with the «Blok xonalari» maket */}
          <RoomScene3D
            rooms={sceneRooms}
            slabWidth={positionedRooms.slabWidth}
            slabDepth={positionedRooms.slabDepth}
            corridorWidth={CORRIDOR_WIDTH}
            isLight={isLight}
            emptyHint={readOnly ? 'Bu qavat uchun tarx hali kiritilmagan.' : "Hali xona qo'shilmagan — yuqoridan xona qo'shing."}
          />
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

      <ConfirmModal
        isOpen={pendingDormId !== null}
        title="Saqlanmagan o'zgarishlar"
        description={`${activeFloor}-qavat tarxida saqlanmagan o'zgarishlar bor.`}
        confirmText="Binoni almashtirish"
        cancelText="Bu qavatda qolish"
        confirmVariant="danger"
        onClose={() => setPendingDormId(null)}
        onConfirm={() => {
          if (pendingDormId !== null) setActiveDormId(pendingDormId)
          setPendingDormId(null)
        }}
      >
        <p className={textMuted}>
          Boshqa binoga o&apos;tsangiz, bu qavatdagi o&apos;zgarishlar saqlanmaydi va yo&apos;qoladi.
          Avval <span className="font-bold">Saqlash</span> tugmasini bosing yoki o&apos;zgarishlarni bekor qiling.
        </p>
      </ConfirmModal>
    </div>
  )
}

// One compact editor row (~36px): drag handle · number · size pill · capacity
// chip · live occupancy dot · move-to-other-side · delete. Kept module-level so
// its useDragControls hook isn't recreated on every parent render (which would
// kill the drag).
function RoomRow({
  block, isLight, textMuted, toneDot, occText, over, defaultCapacity, side,
  onNumber, onCycleSize, onCapacity, onMoveSide, onRemove,
}: {
  block: EditableBlock
  isLight: boolean
  textMuted: string
  toneDot: string
  occText: string
  over: boolean
  defaultCapacity: number | null
  side: RoomBlockSide
  onNumber: (value: string) => void
  onCycleSize: () => void
  onCapacity: (capacity: number | null) => void
  onMoveSide: () => void
  onRemove: () => void
}) {
  const controls = useDragControls()
  const [capOpen, setCapOpen] = useState(false)
  const isOverride = block.capacity != null
  const shownCapacity = block.capacity ?? defaultCapacity
  return (
    <Reorder.Item
      value={block.id}
      dragListener={false}
      dragControls={controls}
      className={`no-shelf relative flex items-center gap-1.5 rounded-xl border pl-1 pr-1.5 h-10 transition-all ${
        isLight
          ? 'border-slate-200/80 bg-white hover:border-slate-300 shadow-2xs'
          : 'border-white/10 bg-slate-800/40 hover:border-white/20'
      }`}
    >
      <span
        onPointerDown={(e) => controls.start(e)}
        className={`no-shelf shrink-0 touch-none cursor-grab active:cursor-grabbing p-1 rounded-md transition-colors ${
          isLight ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
        }`}
        aria-hidden
      >
        <GripVertical size={15} />
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={block.roomNumber}
        onChange={(e) => onNumber(e.target.value)}
        placeholder="№"
        className={`w-12 sm:w-14 shrink-0 text-xs font-bold text-center py-1 rounded-lg outline-none border transition-all ${
          isLight
            ? 'bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            : 'bg-slate-800 border-slate-700 focus:bg-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
        }`}
      />
      <button
        type="button"
        onClick={onCycleSize}
        title="O'lchamni o'zgartirish"
        className={`no-shelf flex-1 min-w-0 flex items-center justify-center gap-1.5 h-7 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors ${
          isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
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

      {/* Sig'im: bo'sh = standartdan meros (xira), override = indigo halqa. */}
      <div className="shrink-0 relative">
        <button
          type="button"
          onClick={() => setCapOpen((o) => !o)}
          title={isOverride ? `Sig'im: ${block.capacity} (istisno)` : `Sig'im: standart (${defaultCapacity ?? '?'})`}
          className={`no-shelf h-7 min-w-[28px] px-1.5 rounded-lg text-[11px] font-black tabular-nums transition-colors ${
            isOverride
              ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30'
              : isLight ? 'bg-slate-100 text-slate-500 hover:text-slate-800' : 'bg-white/5 text-slate-400 hover:text-slate-200'
          }`}
        >
          {shownCapacity ?? '·'}
        </button>
        {capOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setCapOpen(false)} />
            <div
              className={`absolute right-0 top-8 z-20 flex flex-wrap gap-1 w-[136px] rounded-xl border p-1.5 shadow-xl backdrop-blur-md ${
                isLight ? 'border-slate-200 bg-white/95' : 'border-slate-700 bg-slate-900/95'
              }`}
            >
              {CAPACITY_CHOICES.map((c) => (
                <button
                  key={String(c)}
                  type="button"
                  onClick={() => { onCapacity(c); setCapOpen(false) }}
                  className={`no-shelf min-w-[28px] px-1.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                    (c ?? null) === (block.capacity ?? null)
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {c === null ? 'Std' : c}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <span className="shrink-0 flex items-center justify-end gap-1 w-[52px]">
        <span className={`h-2 w-2 rounded-full ${toneDot}`} />
        <span className={`text-[9px] font-bold tabular-nums ${over ? 'text-rose-500' : textMuted}`}>{occText}</span>
      </span>

      {/* Send the room to the other side of the corridor */}
      <button
        type="button"
        onClick={onMoveSide}
        title={side === 'left' ? "O'ng tomonga o'tkazish" : "Chap tomonga o'tkazish"}
        aria-label={side === 'left' ? "O'ng tomonga o'tkazish" : "Chap tomonga o'tkazish"}
        className={`no-shelf shrink-0 p-1.5 rounded-lg transition-colors ${
          isLight ? 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50' : 'text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10'
        }`}
      >
        {side === 'left' ? <ArrowRight size={13} /> : <ArrowLeft size={13} />}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="no-shelf shrink-0 p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 dark:text-rose-400 transition-colors"
        aria-label="O'chirish"
      >
        <Trash2 size={13} />
      </button>
    </Reorder.Item>
  )
}
