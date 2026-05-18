'use client'

import React, { useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Floor3D, Room3D, generateSampleFloors, getRoomStatusClasses } from '@/lib/3d-utils'

interface RoomViewer3DProps {
  onRoomSelect?: (room: Room3D, floor: Floor3D) => void
}

export default function RoomViewer3D({ onRoomSelect }: RoomViewer3DProps) {
  const [floors] = useState<Floor3D[]>(() => generateSampleFloors())
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [selectedRoom, setSelectedRoom] = useState<Room3D | null>(null)

  const activeFloor = useMemo(
    () => floors.find((floor) => floor.number === selectedFloor) ?? floors[0],
    [floors, selectedFloor]
  )

  const handleRoomSelect = (room: Room3D) => {
    setSelectedRoom(room)
    if (activeFloor) {
      onRoomSelect?.(room, activeFloor)
    }
  }

  return (
    <div className="w-full h-full bg-linear-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden border border-white/10">
      <div className="flex h-full gap-6 p-4">
        <div className="w-48 bg-slate-800/50 backdrop-blur rounded-xl p-4 flex flex-col gap-4 border border-white/10">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white">Qavatlar</h3>
          </div>

          <div className="flex flex-col gap-2">
            {floors.map((floor) => (
              <button
                key={floor.id}
                onClick={() => {
                  setSelectedFloor(floor.number)
                  setSelectedRoom(null)
                }}
                className={`p-3 rounded-lg font-semibold transition-all text-sm ${
                  selectedFloor === floor.number
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {floor.name}
              </button>
            ))}
          </div>

          {selectedRoom && (
            <>
              <div className="h-px bg-white/10" />
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase">Tanlangan Xona</h4>
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-white font-bold">Xona #{selectedRoom.number}</p>
                  <p className="text-xs text-slate-400 mt-1">Qavat: {selectedRoom.floorNumber}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getRoomStatusClasses(selectedRoom.status).dot}`} />
                    <span className="text-xs text-slate-300">
                      {selectedRoom.occupied}/{selectedRoom.capacity}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex-1 relative bg-slate-900/50 rounded-xl overflow-hidden border border-white/10 p-6">
          <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.24),transparent_28%),linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px]" />
          <div className="relative h-full flex flex-col">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Interaktiv ko&apos;rinish</p>
                <h3 className="text-2xl font-black text-white mt-2">{activeFloor?.name}</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Xonani tanlang, chap va o&apos;ng panelda batafsil ma&apos;lumot yangilanadi.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                <p className="text-xs text-slate-400">Jami xonalar</p>
                <p className="text-2xl font-black text-white">{activeFloor?.rooms.length ?? 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 flex-1 content-start">
              {activeFloor?.rooms.map((room, index) => {
                const statusUi = getRoomStatusClasses(room.status)
                const isSelected = selectedRoom?.id === room.id

                return (
                  <motion.button
                    key={room.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleRoomSelect(room)}
                    className={`relative overflow-hidden rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? 'scale-[1.02] border-white/40 shadow-[0_20px_50px_rgba(59,130,246,0.25)]'
                        : 'border-white/10 hover:border-white/25 hover:-translate-y-0.5'
                    } bg-linear-to-br ${statusUi.tile}`}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.22),transparent_55%)]" />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white/75">Xona</span>
                        <span className={`h-2.5 w-2.5 rounded-full ${statusUi.dot}`} />
                      </div>
                      <p className="text-3xl font-black text-white mt-3">#{room.number}</p>
                      <p className="text-sm text-white/85 mt-2">
                        {room.occupied}/{room.capacity} band
                      </p>
                      <div
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold mt-4 ${statusUi.badge}`}
                        dangerouslySetInnerHTML={{ __html: statusUi.label }}
                      />
                    </div>
                  </motion.button>
                )
              })}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">Bo&apos;sh xonalar: yashil</div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">Qisman to&apos;la: sariq</div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">To&apos;la xonalar: qizil</div>
            </div>
          </div>
        </div>

        <div className="w-56 bg-slate-800/50 backdrop-blur rounded-xl p-4 flex flex-col gap-4 border border-white/10">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Ma&apos;lumot</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-xs text-slate-300">Bo&apos;sh xonalar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="text-xs text-slate-300">Qisman to&apos;la</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-xs text-slate-300">To&apos;la xonalar</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {selectedRoom ? (
            <div className="flex flex-col gap-3">
              <h4 className="font-bold text-white">Xona Tafsilotlari</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Xona raqami:</span>
                  <span className="font-bold text-white">{selectedRoom.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Qavat:</span>
                  <span className="font-bold text-white">{selectedRoom.floorNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Sig&apos;im:</span>
                  <span className="font-bold text-white">{selectedRoom.capacity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Band qismi:</span>
                  <span className="font-bold text-white">
                    {selectedRoom.occupied}/{selectedRoom.capacity}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Holat:</span>
                  <span
                    className={`font-bold ${
                      selectedRoom.status === 'empty'
                        ? 'text-green-400'
                        : selectedRoom.status === 'full'
                          ? 'text-red-400'
                          : 'text-yellow-400'
                    }`}
                    dangerouslySetInnerHTML={{ __html: getRoomStatusClasses(selectedRoom.status).label }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">Xona tafsilotlarini ko&apos;rish uchun</p>
              <p className="text-sm text-slate-400">interaktiv kartochkalardan birini bosing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
