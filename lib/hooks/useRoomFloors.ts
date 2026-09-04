'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchRoomFloors } from '@/features/room-layout/client/api'
import { buildRoomCapacityMap, buildRoomFloorMap, buildRoomGenderMap, resolveFloor } from '@/features/room-layout/floor-map'
import type { RoomFloorStatus } from '@/features/room-layout/types'

export interface RoomFloors {
  /** Admin-entered room -> floor pairs (plus ta'mirlash freeze state), in floor then room order. */
  rooms: RoomFloorStatus[]
  /** Every floor that actually has at least one room, ascending. */
  floors: number[]
  /** Room number -> floor, for callers that need the raw map. */
  map: Map<string, number>
  /** Resolved floor for a room, falling back to the legacy guess. */
  floorOf: (roomNumber?: string | null) => number | null
  /** Raw per-room capacity override; null = inherit the dorm default, undefined = unknown room. */
  capacityOf: (roomNumber?: string | null) => number | null | undefined
  /** Effective bed count for a room: its override, else `fallback`. */
  effectiveCapacity: (roomNumber: string | null | undefined, fallback: number | null) => number | null
  /** Declared room gender; null = undeclared, undefined = unknown room. */
  genderOf: (roomNumber?: string | null) => 'male' | 'female' | null | undefined
  loaded: boolean
  /** Re-fetches the map, e.g. right after rooms are created. */
  reload: () => Promise<void>
}

/**
 * Loads the admin's "qaysi xona qaysi qavatda" map once per mount.
 *
 * Every page that shows or filters by floor should go through this instead
 * of `extractFloor`, so changing a room's floor in the Qavat tarxi
 * quruvchisi is reflected everywhere without touching the students' stored
 * `assigned_floor`. Until the fetch resolves, `floorOf` still answers using
 * the old room-number guess so nothing renders blank mid-load.
 *
 * `dormId` targets one specific one of the faculty's buildings
 * (many-to-many, 202609300000) — only the room-layout editor, which lets the
 * dekan pick a building, ever passes one; every other caller omits it and
 * keeps resolving the faculty's primary building, unchanged. Passing a
 * different `dormId` across renders re-fetches for the new building.
 */
export function useRoomFloors(dormId?: string): RoomFloors {
  const [rooms, setRooms] = useState<RoomFloorStatus[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try {
      setRooms(await fetchRoomFloors(dormId))
    } catch (error) {
      console.error('Qavat ma\'lumotini yuklashda xato:', error)
    } finally {
      setLoaded(true)
    }
  }, [dormId])

  useEffect(() => {
    let cancelled = false
    setLoaded(false)

    fetchRoomFloors(dormId)
      .then((result) => {
        if (!cancelled) setRooms(result)
      })
      .catch((error) => {
        console.error('Qavat ma\'lumotini yuklashda xato:', error)
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [dormId])

  const map = useMemo(() => buildRoomFloorMap(rooms), [rooms])
  const capacityMap = useMemo(() => buildRoomCapacityMap(rooms), [rooms])
  const genderMap = useMemo(() => buildRoomGenderMap(rooms), [rooms])
  const floors = useMemo(
    () => [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b),
    [rooms],
  )
  const floorOf = useCallback(
    (roomNumber?: string | null) => resolveFloor(map, roomNumber),
    [map],
  )
  const capacityOf = useCallback(
    (roomNumber?: string | null) =>
      roomNumber ? capacityMap.get(roomNumber.trim()) : undefined,
    [capacityMap],
  )
  const effectiveCapacity = useCallback(
    (roomNumber: string | null | undefined, fallback: number | null) => {
      const override = roomNumber ? capacityMap.get(roomNumber.trim()) : undefined
      return override ?? fallback
    },
    [capacityMap],
  )
  const genderOf = useCallback(
    (roomNumber?: string | null) => (roomNumber ? genderMap.get(roomNumber.trim()) : undefined),
    [genderMap],
  )

  return { rooms, floors, map, floorOf, capacityOf, effectiveCapacity, genderOf, loaded, reload }
}
