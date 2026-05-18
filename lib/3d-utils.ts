export interface Room3D {
  id: string
  number: number
  floorNumber: number
  capacity: number
  occupied: number
  status: 'empty' | 'occupied' | 'full'
}

export interface Floor3D {
  id: string
  number: number
  name: string
  rooms: Room3D[]
}

export const generateSampleFloors = (): Floor3D[] => {
  const floors: Floor3D[] = []

  for (let floorNum = 1; floorNum <= 3; floorNum++) {
    const rooms: Room3D[] = []

    for (let roomNum = 1; roomNum <= 10; roomNum++) {
      const occupied = Math.floor(Math.random() * 5)
      rooms.push({
        id: `room-${floorNum}-${roomNum}`,
        number: roomNum,
        floorNumber: floorNum,
        capacity: 4,
        occupied: Math.min(occupied, 4),
        status: occupied === 0 ? 'empty' : occupied >= 4 ? 'full' : 'occupied',
      })
    }

    floors.push({
      id: `floor-${floorNum}`,
      number: floorNum,
      name: `${floorNum}-Qavat`,
      rooms,
    })
  }

  return floors
}

export const getRoomStatusClasses = (status: Room3D['status']) => {
  if (status === 'empty') {
    return {
      badge: 'bg-green-500/20 text-green-400 border-green-400/30',
      tile: 'from-green-500 to-emerald-500 border-green-300/30',
      dot: 'bg-green-400',
      label: 'Bo&apos;sh',
    }
  }

  if (status === 'full') {
    return {
      badge: 'bg-red-500/20 text-red-400 border-red-400/30',
      tile: 'from-red-500 to-rose-500 border-red-300/30',
      dot: 'bg-red-400',
      label: 'To&apos;la',
    }
  }

  return {
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-300/30',
    tile: 'from-yellow-400 to-amber-500 border-yellow-200/40',
    dot: 'bg-yellow-400',
    label: 'Qisman',
  }
}
