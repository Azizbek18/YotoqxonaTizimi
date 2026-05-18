'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as BABYLON from 'babylonjs'
import { generateSampleFloors, createFloorLayout, createWalls, Floor3D, Room3D } from '@/lib/3d-utils'
import { Building2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface RoomViewer3DProps {
  onRoomSelect?: (room: Room3D, floor: Floor3D) => void
}

export default function RoomViewer3D({ onRoomSelect }: RoomViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BABYLON.Scene | null>(null)
  const engineRef = useRef<BABYLON.Engine | null>(null)
  const cameraRef = useRef<BABYLON.UniversalCamera | null>(null)
  const floorsDataRef = useRef<Floor3D[]>([])

  const [floors, setFloors] = useState<Floor3D[]>([])
  const [selectedFloor, setSelectedFloor] = useState<number>(1)
  const [selectedRoom, setSelectedRoom] = useState<Room3D | null>(null)
  const [loading, setLoading] = useState(true)

  // Initialize 3D scene
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = new BABYLON.Engine(canvas, true, {
      stencil: true,
      antialias: true,
    })

    const scene = new BABYLON.Scene(engine)
    scene.clearColor = new BABYLON.Color4(0.1, 0.1, 0.15, 1)

    // Generate sample data
    const floorsData = generateSampleFloors()
    floorsDataRef.current = floorsData
    setFloors(floorsData)

    // Camera setup
    const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 4, 8), scene)
    camera.attachControl(canvas, true)
    camera.speed = 0
    camera.angularSensibility = 1000
    camera.inertia = 0.7

    // Restrict camera movement
    camera.keysUp = []
    camera.keysDown = []
    camera.keysLeft = []
    camera.keysRight = []

    cameraRef.current = camera

    // Lights
    const light1 = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene)
    light1.intensity = 0.8

    const light2 = new BABYLON.PointLight('light2', new BABYLON.Vector3(5, 10, 5), scene)
    light2.intensity = 0.6

    // Create all floors
    floorsData.forEach((floor, index) => {
      const startY = index * 3.5
      createFloorLayout(scene, floor, startY)
      createWalls(scene, startY)
    })

    // Mouse click handler for room selection
    let lastClick = 0
    canvas.addEventListener('click', (event) => {
      const now = Date.now()
      if (now - lastClick < 200) return
      lastClick = now

      const pickResult = scene.pick(event.clientX, event.clientY)
      if (pickResult?.hit && pickResult.pickedMesh) {
        const mesh = pickResult.pickedMesh as any
        if (mesh.roomData) {
          const room = mesh.roomData as Room3D
          const floor = floorsData.find((f) => f.number === room.floorNumber)

          if (floor) {
            setSelectedRoom(room)
            setSelectedFloor(floor.number)

            if (onRoomSelect) {
              onRoomSelect(room, floor)
            }

            // Animate camera to room
            animateCameraToRoom(camera, mesh.position)
          }
        }
      }
    })

    engineRef.current = engine
    sceneRef.current = scene

    // Render loop
    const resizeObserver = new ResizeObserver(() => {
      engine.resize()
    })
    resizeObserver.observe(canvas)

    engine.runRenderLoop(() => {
      scene.render()
    })

    setLoading(false)

    return () => {
      resizeObserver.disconnect()
      engine.dispose()
      scene.dispose()
    }
  }, [onRoomSelect])

  // Animate camera to room
  const animateCameraToRoom = (camera: BABYLON.UniversalCamera, roomPos: BABYLON.Vector3) => {
    if (!sceneRef.current) return

    const targetPos = new BABYLON.Vector3(
      roomPos.x,
      roomPos.y + 2,
      roomPos.z + 4
    )

    const animation = new BABYLON.Animation(
      'cameraMove',
      'position',
      30,
      BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
      BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    )

    const keys = [
      { frame: 0, value: camera.position.clone() },
      { frame: 30, value: targetPos },
    ]

    animation.setKeys(keys)
    sceneRef.current.beginAnimation(camera, 0, 30, false)
  }

  // Handle floor change
  const changeFloor = (floorNumber: number) => {
    if (sceneRef.current && cameraRef.current) {
      setSelectedFloor(floorNumber)
      setSelectedRoom(null)

      // Simple camera reset
      const newPos = new BABYLON.Vector3(0, 3 + floorNumber * 3.5, 8)
      cameraRef.current.position = newPos
    }
  }

  return (
    <div className="w-full h-full bg-linear-to-br from-slate-900 to-slate-800 rounded-2xl overflow-hidden border border-white/10">
      <div className="flex h-full gap-6 p-4">
        {/* Left Sidebar - Floor Selector */}
        <div className="w-48 bg-slate-800/50 backdrop-blur rounded-xl p-4 flex flex-col gap-4 border border-white/10">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-white">Qavatlar</h3>
          </div>

          <div className="flex flex-col gap-2">
            {floors.map((floor) => (
              <button
                key={floor.id}
                onClick={() => changeFloor(floor.number)}
                className={`p-3 rounded-lg font-semibold transition-all text-sm ${selectedFloor === floor.number
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
                  <p className="text-white font-bold">
                    Xona #{selectedRoom.number}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Qavat: {selectedRoom.floorNumber}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${selectedRoom.status === 'empty'
                        ? 'bg-green-400'
                        : selectedRoom.status === 'full'
                          ? 'bg-red-400'
                          : 'bg-yellow-400'
                        }`}
                    />
                    <span className="text-xs text-slate-300">
                      {selectedRoom.occupied}/{selectedRoom.capacity}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Center - 3D Canvas */}
        <div className="flex-1 relative bg-slate-900/50 rounded-xl overflow-hidden border border-white/10">
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-10"
            >
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-slate-600 border-t-purple-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-300 font-medium">3D Ko'rinish yuklanmoqda...</p>
              </div>
            </motion.div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: 'block' }}
          />

          {/* Camera Controls */}
          <div className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur border border-white/10 rounded-lg p-3">
            <p className="text-xs text-slate-400 font-medium mb-2">Boshqarish:</p>
            <div className="space-y-1 text-xs text-slate-300">
              <p>🖱️ Aylantirish va Siljitish</p>
              <p>🔍 O'lchamini o'zgartirish: Scroll</p>
              <p>🎯 Xonani tanlash: Bosish</p>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Info */}
        <div className="w-56 bg-slate-800/50 backdrop-blur rounded-xl p-4 flex flex-col gap-4 border border-white/10">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Ma'lumot</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-xs text-slate-300">Bo'sh xonalar</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="text-xs text-slate-300">Qisman to'la</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <span className="text-xs text-slate-300">To'la xonalar</span>
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
                  <span className="text-slate-400">Sig'im:</span>
                  <span className="font-bold text-white">{selectedRoom.capacity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">To'la bo'lgan:</span>
                  <span className="font-bold text-white">
                    {selectedRoom.occupied}/{selectedRoom.capacity}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Holat:</span>
                  <span
                    className={`font-bold ${selectedRoom.status === 'empty'
                      ? 'text-green-400'
                      : selectedRoom.status === 'full'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                      }`}
                  >
                    {selectedRoom.status === 'empty'
                      ? "Bo'sh"
                      : selectedRoom.status === 'full'
                        ? 'To\'la'
                        : 'Qisman'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">Xona tafsilotlarini ko'rish uchun</p>
              <p className="text-sm text-slate-400">3D ko'rinishda xonani bosing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
