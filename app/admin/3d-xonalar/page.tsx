'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Boxes, Building2, DoorOpen, Layers3, Users } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import RoomViewer3D from '@/components/admin/RoomViewer3D'
import { Floor3D, Room3D, RoomOccupancySnapshot } from '@/lib/3d-utils'

export default function Admin3DXonalarPage() {
  const [roomSnapshots, setRoomSnapshots] = useState<RoomOccupancySnapshot[]>([])
  const [selectedRoom, setSelectedRoom] = useState<Room3D | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<Floor3D | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadRoomOccupancy() {
      try {
        const { data } = await supabase
          .from('users')
          .select('room_number')
          .eq('role', 'talaba')
          .not('room_number', 'is', null)

        const occupancyMap = new Map<string, number>()
        data?.forEach((user) => {
          if (!user.room_number) return
          occupancyMap.set(user.room_number, (occupancyMap.get(user.room_number) ?? 0) + 1)
        })

        setRoomSnapshots(
          Array.from(occupancyMap.entries()).map(([roomNumber, occupied]) => ({
            roomNumber,
            occupied,
            capacity: 4,
          }))
        )
      } catch (error) {
        console.error('3D xonalar bandligini yuklashda xato:', error)
      } finally {
        setLoading(false)
      }
    }

    loadRoomOccupancy()
  }, [])

  const summary = useMemo(() => {
    const occupiedPlaces = roomSnapshots.reduce((total, room) => total + room.occupied, 0)
    const knownRooms = roomSnapshots.length

    return {
      occupiedPlaces,
      knownRooms,
      freePlaces: Math.max(knownRooms * 4 - occupiedPlaces, 0),
    }
  }, [roomSnapshots])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-bold text-cyan-200">
            <Boxes className="h-4 w-4" />
            3D xonalar boshqaruvi
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Qavatlar bo'yicha 3D xona rejasi
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Har bir qavat alohida 3D formatda ochiladi. Xonalar yirik bloklarda ko'rinadi,
            bandlik holati rang bilan ajratilgan va tanlangan xona darhol tafsilot paneliga chiqadi.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[520px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Users className="h-4 w-4 text-cyan-300" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Band joy</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">{loading ? '...' : summary.occupiedPlaces}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <DoorOpen className="h-4 w-4 text-emerald-300" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Bo'sh joy</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">{loading ? '...' : summary.freePlaces}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Layers3 className="h-4 w-4 text-amber-300" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Faol qavat</span>
            </div>
            <p className="mt-2 truncate text-2xl font-black text-white">{selectedFloor?.name ?? '1-qavat'}</p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-[calc(100vh-16rem)] min-h-[720px]"
      >
        <RoomViewer3D
          roomSnapshots={roomSnapshots}
          onRoomSelect={(room, floor) => {
            setSelectedRoom(room)
            setSelectedFloor(floor)
          }}
          onFloorChange={(floor) => {
            setSelectedFloor(floor)
            setSelectedRoom(null)
          }}
        />
      </motion.div>

      {selectedRoom && selectedFloor && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-white/10 bg-white/[0.04] p-5"
        >
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-cyan-300" />
            <h2 className="text-lg font-black text-white">Tanlangan xona tafsilotlari</h2>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Detail label="Qavat" value={selectedFloor.name} />
            <Detail label="Xona raqami" value={`#${selectedRoom.number}`} />
            <Detail label="Sig'im" value={`${selectedRoom.occupied}/${selectedRoom.capacity}`} />
            <Detail
              label="Holat"
              value={selectedRoom.status === 'empty' ? "Bo'sh" : selectedRoom.status === 'full' ? "To'la" : 'Qisman'}
            />
          </div>
        </motion.div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  )
}
