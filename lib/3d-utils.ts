export type RoomStatus = 'empty' | 'occupied' | 'full'

export interface Room3D {
  id: string
  number: number
  floorNumber: number
  capacity: number
  occupied: number
  status: RoomStatus
  position: {
    x: number
    y: number
    z: number
  }
  size: {
    width: number
    height: number
    depth: number
  }
  wing: 'left' | 'right'
}

export interface Floor3D {
  id: string
  number: number
  name: string
  elevation: number
  rooms: Room3D[]
}

export interface RoomOccupancySnapshot {
  roomNumber: string | number
  occupied: number
  capacity?: number
}

interface RoomStatusUi {
  badge: string
  tile: string
  dot: string
  color: string
  accent: string
  label: string
}

const ROOM_WIDTH = 2.2
const ROOM_HEIGHT = 1
const ROOM_DEPTH = 2.6
const CORRIDOR_WIDTH = 2.4
const ROOM_GAP = 0.35
const FLOOR_HEIGHT = 3.4
const DEFAULT_FLOORS = [1, 2, 3, 4, 5]
const DEFAULT_ROOM_COUNT_PER_FLOOR = 30
const DEFAULT_ROOM_CAPACITY = 4

const occupiedPattern = [0, 1, 2, 4, 3, 2, 4, 1, 0, 3, 2, 4]

const parseRoomNumber = (value: string | number): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const match = String(value).match(/\d+/)
  if (!match) {
    return null
  }

  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

const buildDefaultRoomNumbers = () =>
  DEFAULT_FLOORS.flatMap((floorNumber) =>
    Array.from({ length: DEFAULT_ROOM_COUNT_PER_FLOOR }, (_, index) => (floorNumber - 1) * DEFAULT_ROOM_COUNT_PER_FLOOR + index + 1)
  )

export const generateSampleFloors = (roomSnapshots: RoomOccupancySnapshot[] = []): Floor3D[] => {
  const occupancyByRoom = new Map<number, RoomOccupancySnapshot>()

  roomSnapshots.forEach((snapshot) => {
    const parsedRoomNumber = parseRoomNumber(snapshot.roomNumber)
    if (!parsedRoomNumber) return

    occupancyByRoom.set(parsedRoomNumber, {
      roomNumber: parsedRoomNumber,
      occupied: Math.max(snapshot.occupied, 0),
      capacity: snapshot.capacity,
    })
  })

  const knownRoomNumbers = new Set<number>(buildDefaultRoomNumbers())
  occupancyByRoom.forEach((_, roomNumber) => {
    if (roomNumber > 0) {
      knownRoomNumbers.add(roomNumber)
    }
  })

  const floorsByNumber = new Map<number, number[]>()
  Array.from(knownRoomNumbers)
    .sort((left, right) => left - right)
    .forEach((roomNumber) => {
      const floorNumber = Math.max(1, Math.floor((roomNumber - 1) / 30) + 1)
      const roomNumbers = floorsByNumber.get(floorNumber) ?? []
      roomNumbers.push(roomNumber)
      floorsByNumber.set(floorNumber, roomNumbers)
    })

  return Array.from(floorsByNumber.entries()).map(([floorNumber, roomNumbers]) => {
    const rooms: Room3D[] = []
    const elevation = (floorNumber - 1) * FLOOR_HEIGHT
    const splitIndex = Math.ceil(roomNumbers.length / 2)
    const leftWing = roomNumbers.slice(0, splitIndex)
    const rightWing = roomNumbers.slice(splitIndex)
    const maxPerSide = Math.max(leftWing.length, rightWing.length, 1)

    roomNumbers.forEach((roomNumber, index) => {
      const isLeftWing = index < splitIndex
      const wing: Room3D['wing'] = isLeftWing ? 'left' : 'right'
      const localIndex = isLeftWing ? index : index - splitIndex
      const occupiedFallback = occupiedPattern[(floorNumber * 3 + index) % occupiedPattern.length]
      const occupancySnapshot = occupancyByRoom.get(roomNumber)
      const capacity = Math.max(occupancySnapshot?.capacity ?? DEFAULT_ROOM_CAPACITY, 1)
      const occupied = Math.min(occupancySnapshot?.occupied ?? occupiedFallback, capacity)
      const z = (localIndex - (maxPerSide - 1) / 2) * (ROOM_DEPTH + ROOM_GAP)
      const xOffset = CORRIDOR_WIDTH / 2 + ROOM_WIDTH / 2 + 0.35
      const x = wing === 'left' ? -xOffset : xOffset

      rooms.push({
        id: `floor-${floorNumber}-room-${roomNumber}`,
        number: roomNumber,
        floorNumber,
        capacity: 4,
        occupied,
        status: occupied === 0 ? 'empty' : occupied >= 4 ? 'full' : 'occupied',
        position: {
          x,
          y: elevation + ROOM_HEIGHT / 2,
          z,
        },
        size: {
          width: ROOM_WIDTH,
          height: ROOM_HEIGHT,
          depth: ROOM_DEPTH,
        },
        wing,
      })
    })

    return {
      id: `floor-${floorNumber}`,
      number: floorNumber,
      name: `${floorNumber}-Qavat`,
      elevation,
      rooms,
    }
  })
}

export const getRoomStatusClasses = (status: RoomStatus): RoomStatusUi => {
  if (status === 'empty') {
    return {
      badge: 'bg-green-500/20 text-green-400 border-green-400/30',
      tile: 'from-green-500 to-emerald-500 border-green-300/30',
      dot: 'bg-green-400',
      color: '#22c55e',
      accent: '#86efac',
      label: "Bo'sh",
    }
  }

  if (status === 'full') {
    return {
      badge: 'bg-red-500/20 text-red-400 border-red-400/30',
      tile: 'from-red-500 to-rose-500 border-red-300/30',
      dot: 'bg-red-400',
      color: '#ef4444',
      accent: '#fda4af',
      label: "To'la",
    }
  }

  return {
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-300/30',
    tile: 'from-yellow-400 to-amber-500 border-yellow-200/40',
    dot: 'bg-yellow-400',
    color: '#f59e0b',
    accent: '#fde68a',
    label: 'Qisman',
  }
}

export const getFloorDimensions = (roomsPerSide = DEFAULT_ROOM_COUNT_PER_FLOOR / 2) => ({
  width: ROOM_WIDTH * 2 + CORRIDOR_WIDTH + 2.8,
  depth: roomsPerSide * ROOM_DEPTH + Math.max(roomsPerSide - 1, 0) * ROOM_GAP + 2,
  corridorWidth: CORRIDOR_WIDTH,
  floorHeight: FLOOR_HEIGHT,
})
