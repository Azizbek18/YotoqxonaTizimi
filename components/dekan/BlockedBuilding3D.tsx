'use client'

import { useMemo } from 'react'
import { UserPlus } from 'lucide-react'
import { dekanUI } from '@/lib/dekan-ui'
import type { BlockedRoomSection } from '@/features/dorms/types'
import { CORRIDOR_WIDTH, sectionFloorLayout } from '@/lib/blocked-building-3d'
import RoomScene3D, { type SceneRoom } from './RoomScene3D'

interface Props {
  /** The section (block + floor) chosen in the chips above. */
  section: BlockedRoomSection
  isLight: boolean
  /** Fired when the "place a student" button inside the room card is pressed. */
  onPickRoom: (roomNumber: string) => void
}

export default function BlockedBuilding3D({ section, isLight, onPickRoom }: Props) {
  const ui = dekanUI(isLight)

  const { rooms, slabWidth, slabDepth } = useMemo(() => {
    const layout = sectionFloorLayout(section.rooms)
    const byNumber = new Map(section.rooms.map((r) => [r.roomNumber, r]))
    const rooms: SceneRoom[] = layout.rooms.map((r) => {
      const src = byNumber.get(r.roomNumber)
      return {
        roomNumber: r.roomNumber,
        x: r.x, z: r.z, width: r.width, depth: r.depth, height: r.height,
        frozen: r.frozen,
        capacity: r.capacity,
        occupied: r.occupied,
        occupants: src?.occupants.map((o) => o.name) ?? [],
      }
    })
    return { rooms, slabWidth: layout.slabWidth, slabDepth: layout.slabDepth }
  }, [section.rooms])

  return (
    <RoomScene3D
      rooms={rooms}
      slabWidth={slabWidth}
      slabDepth={slabDepth}
      corridorWidth={CORRIDOR_WIDTH}
      isLight={isLight}
      renderCardAction={(roomNumber) => {
        const room = section.rooms.find((r) => r.roomNumber === roomNumber)
        if (!room || room.frozen) return null
        const free = Math.max(0, room.capacity - room.occupants.length)
        if (free === 0) return null
        return (
          <button
            onClick={() => onPickRoom(roomNumber)}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-bold uppercase tracking-wider ${ui.accentSolid}`}
          >
            <UserPlus size={12} /> Joylashtirish ({free})
          </button>
        )
      }}
    />
  )
}
