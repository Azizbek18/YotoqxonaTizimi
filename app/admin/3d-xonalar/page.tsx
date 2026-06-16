'use client'

import React, { useEffect, useMemo, useState, useRef } from 'react'
import { 
  Building2, DoorOpen, Layers3, Users, 
  Info, MousePointer2, ExternalLink, Upload, Cpu, 
  RotateCcw, CheckCircle2, ChevronRight 
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useThemeStore } from '@/lib/stores/theme-store'
import toast from 'react-hot-toast'
import * as THREE from 'three'

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

export default function Admin3DXonalarPage() {
  const [roomSnapshots, setRoomSnapshots] = useState<RoomOccupancySnapshot[]>([])
  const [selectedRoomNumber, setSelectedRoomNumber] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Floor Selector State (1st, 2nd, and 3rd floors)
  const [activeFloor, setActiveFloor] = useState<number>(1)
  const floors = [1, 2, 3]

  // Floor-specific Blueprint & AI States
  const [floorBlueprints, setFloorBlueprints] = useState<Record<number, File>>({})
  const [floorPreviews, setFloorPreviews] = useState<Record<number, string>>({})
  const [floorAnalyzing, setFloorAnalyzing] = useState<Record<number, boolean>>({})
  const [floorProgress, setFloorProgress] = useState<Record<number, number>>({})
  const [floorStructures, setFloorStructures] = useState<Record<number, string[]>>({})
  const [builtFloors, setBuiltFloors] = useState<Record<number, boolean>>({})

  // Three.js refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const roomMeshesRef = useRef<THREE.Mesh[]>([])

  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'

  const surfaceBg = isLight ? 'bg-white/80 border-slate-200 shadow-lg' : 'bg-[#0b1120]/50 border-white/10 shadow-[0_0_20px_rgba(6,182,212,0.05)]'
  const cardBg = isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-white/[0.04] border-white/10'
  const textMuted = isLight ? 'text-slate-600' : 'text-slate-400'
  const textStrong = isLight ? 'text-slate-900' : 'text-white'

  // Load Room Occupancy from Supabase
  const loadRoomOccupancy = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('id, room_number, full_name')
        .eq('role', 'talaba')
        .not('room_number', 'is', null)

      if (error) throw error

      const occupancyMap = new Map<string, { count: number, students: StudentInfo[] }>()
      data?.forEach((user) => {
        if (!user.room_number) return
        const existing = occupancyMap.get(user.room_number) || { count: 0, students: [] }
        occupancyMap.set(user.room_number, {
          count: existing.count + 1,
          students: [...existing.students, { id: user.id, name: user.full_name }]
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
      console.error('3D xonalar bandligini yuklashda xato:', error)
      toast.error('Ma\'lumotlarni yuklashda xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoomOccupancy()
  }, [])

  // Blueprint File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setFloorBlueprints(prev => ({ ...prev, [activeFloor]: file }))
      setFloorPreviews(prev => ({ ...prev, [activeFloor]: URL.createObjectURL(file) }))
      toast.success(`${activeFloor}-qavat uchun chizma muvaffaqiyatli yuklandi! 📐`)
    }
  }

  // Simulate AI Analysis of Blueprint for the selected floor
  const startAIAnalysis = () => {
    const file = floorBlueprints[activeFloor]
    if (!file) return

    setFloorAnalyzing(prev => ({ ...prev, [activeFloor]: true }))
    setFloorProgress(prev => ({ ...prev, [activeFloor]: 0 }))

    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setFloorProgress(prev => ({ ...prev, [activeFloor]: progress }))

      if (progress >= 100) {
        clearInterval(interval)
        
        // Generate rooms specifically for the selected floor (e.g. 1-6 for floor 1, 31-36 for floor 2, etc.)
        const startRoom = (activeFloor - 1) * 30 + 1
        const parsedRooms = Array.from({ length: 6 }, (_, idx) => String(startRoom + idx))

        setFloorStructures(prev => ({ ...prev, [activeFloor]: parsedRooms }))
        setFloorAnalyzing(prev => ({ ...prev, [activeFloor]: false }))
        toast.success(`AI ${activeFloor}-qavat chizmasini tahlil qildi va xonalar rejasini aniqladi! 🧠⚡`)
      }
    }, 250)
  }

  // Build 3D Model for the selected floor
  const build3DModel = () => {
    if (!floorStructures[activeFloor]) return
    setBuiltFloors(prev => ({ ...prev, [activeFloor]: true }))
    setSelectedRoomNumber(null)
    toast.success(`${activeFloor}-qavat 3D modeli muvaffaqiyatli qurildi! 🏢`)
  }

  // Reset/Re-analyze blueprint for active floor
  const resetFloorModel = () => {
    setBuiltFloors(prev => {
      const copy = { ...prev }
      delete copy[activeFloor]
      return copy
    })
    setFloorStructures(prev => {
      const copy = { ...prev }
      delete copy[activeFloor]
      return copy
    })
    setFloorPreviews(prev => {
      const copy = { ...prev }
      delete copy[activeFloor]
      return copy
    })
    setFloorBlueprints(prev => {
      const copy = { ...prev }
      delete copy[activeFloor]
      return copy
    })
    setSelectedRoomNumber(null)
  }

  // Initialize and Render Three.js Scene for the active floor
  useEffect(() => {
    const isBuilt = builtFloors[activeFloor]
    const rooms = floorStructures[activeFloor]
    if (!isBuilt || !canvasRef.current || !rooms) return

    const canvas = canvasRef.current
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // 1. Scene setup
    const scene = new THREE.Scene()
    sceneRef.current = scene

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 5, 8)
    camera.lookAt(0, 0, 0)

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(width, height, false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    rendererRef.current = renderer

    // Resize Observer for dynamic container sizing (fluid adjustment on panel resize/window resize)
    const resizeObserver = new ResizeObserver(() => {
      if (!canvas || !rendererRef.current) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      rendererRef.current.setSize(w, h, false)
    })
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement)
    }

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight1.position.set(5, 10, 7)
    scene.add(dirLight1)

    const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 0.5) // Cyan fill
    dirLight2.position.set(-5, 5, -5)
    scene.add(dirLight2)

    // 5. Room Group (for rotation)
    const roomGroup = new THREE.Group()
    scene.add(roomGroup)
    groupRef.current = roomGroup

    // 6. Floor Slab (Pol Asosi)
    const half = Math.ceil(rooms.length / 2)
    const maxRoomsInRow = Math.max(half, rooms.length - half)
    const slabWidth = Math.max(maxRoomsInRow * 2.5, 6)
    const slabDepth = 5.2

    const slabGeo = new THREE.BoxGeometry(slabWidth, 0.15, slabDepth)
    const slabMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0xe2e8f0 : 0x111827,
      roughness: 0.8,
      metalness: 0.1,
    })
    const slabMesh = new THREE.Mesh(slabGeo, slabMat)
    slabMesh.position.set(0, -0.075, 0)
    roomGroup.add(slabMesh)

    // Glowing neon slab border
    const slabEdges = new THREE.EdgesGeometry(slabGeo)
    const slabLineMat = new THREE.LineBasicMaterial({
      color: isLight ? 0x94a3b8 : 0x06b6d4,
      linewidth: 1.5,
    })
    const slabWireframe = new THREE.LineSegments(slabEdges, slabLineMat)
    slabMesh.add(slabWireframe)

    // 7. Generate Room Blocks (Double-sided Corridor Layout)
    const meshes: THREE.Mesh[] = []
    const boxGeo = new THREE.BoxGeometry(1.8, 1.0, 1.8)

    rooms.forEach((roomNum, idx) => {
      let xOffset = 0
      let zOffset = 0

      // Split into two parallel rows
      if (idx < half) {
        // Top row
        xOffset = (idx - (half - 1) / 2) * 2.4
        zOffset = -1.3
      } else {
        // Bottom row
        const bottomIdx = idx - half
        const bottomHalf = rooms.length - half
        xOffset = (bottomIdx - (bottomHalf - 1) / 2) * 2.4
        zOffset = 1.3
      }

      // Occupancy color-coding from snapshots
      const snap = roomSnapshots.find(s => s.roomNumber === roomNum)
      const occupied = snap?.occupied ?? 0

      let color = 0x10b981 // Green (empty)
      if (occupied >= 4) color = 0xef4444 // Red (full)
      else if (occupied > 0) color = 0xf59e0b // Yellow (partial)

      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
      })

      const mesh = new THREE.Mesh(boxGeo, material)
      mesh.position.set(xOffset, 0.5, zOffset)
      mesh.name = roomNum
      roomGroup.add(mesh)
      meshes.push(mesh)

      // Add wireframe neon highlights
      const edges = new THREE.EdgesGeometry(boxGeo)
      const lineMat = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
      })
      const wireframe = new THREE.LineSegments(edges, lineMat)
      mesh.add(wireframe)
    })

    roomMeshesRef.current = meshes

    // 8. Mouse Orbit Drag Control
    let isDragging = false
    let prevMousePos = { x: 0, y: 0 }

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevMousePos = { x: e.offsetX, y: e.offsetY }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaMove = {
        x: e.offsetX - prevMousePos.x,
        y: e.offsetY - prevMousePos.y
      }

      roomGroup.rotation.y += deltaMove.x * 0.005
      roomGroup.rotation.x += deltaMove.y * 0.005

      // Rotation boundaries
      roomGroup.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, roomGroup.rotation.x))

      prevMousePos = { x: e.offsetX, y: e.offsetY }
    }

    const onMouseUp = () => {
      isDragging = false
    }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // 9. Raycasting (clicking a room)
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onCanvasClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(meshes)

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh
        setSelectedRoomNumber(clickedMesh.name)
        
        // Highlight animation pulse
        clickedMesh.scale.set(1.08, 1.08, 1.08)
        setTimeout(() => {
          clickedMesh.scale.set(1.0, 1.0, 1.0)
        }, 150)
        
        toast.success(`Xona #${clickedMesh.name} tanlandi! 🚪`)
      }
    }

    canvas.addEventListener('click', onCanvasClick)

    // 10. Animation Loop
    let animationFrameId: number
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      // Auto rotation when idle
      if (!isDragging) {
        roomGroup.rotation.y += 0.0015
      }

      renderer.render(scene, camera)
    }
    animate()

    // 11. Cleanup function
    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(animationFrameId)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('click', onCanvasClick)
      
      meshes.forEach(m => {
        m.geometry.dispose()
        if (Array.isArray(m.material)) {
          m.material.forEach(mat => mat.dispose())
        } else {
          m.material.dispose()
        }
      })
      slabGeo.dispose()
      slabMat.dispose()
      renderer.dispose()
    }
  }, [activeFloor, builtFloors, floorStructures, roomSnapshots, isLight])

  // Current floor statistics
  const summary = useMemo(() => {
    const rooms = floorStructures[activeFloor] || []
    const occupiedPlaces = roomSnapshots
      .filter(room => rooms.includes(room.roomNumber))
      .reduce((total, room) => total + room.occupied, 0)
    
    return {
      occupiedPlaces,
      totalRooms: rooms.length,
      freePlaces: Math.max(rooms.length * 4 - occupiedPlaces, 0),
    }
  }, [roomSnapshots, activeFloor, floorStructures])

  // Selected room details
  const selectedRoomData = useMemo(() => {
    if (!selectedRoomNumber) return null
    const snap = roomSnapshots.find(s => s.roomNumber === selectedRoomNumber)
    return {
      number: selectedRoomNumber,
      occupied: snap?.occupied ?? 0,
      capacity: 4,
      students: snap?.students ?? []
    }
  }, [selectedRoomNumber, roomSnapshots])

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-400">
            <Cpu className="h-4 w-4" />
            AI Qavatma-Qavat 3D Quruvchisi
          </div>
          <h1 className={`mt-4 text-3xl font-black tracking-tight sm:text-4xl ${textStrong}`}>
            Dynamic 3D Bino Modeli
          </h1>
          <p className={`mt-3 max-w-3xl text-sm leading-6 ${textMuted}`}>
            Har bir qavat uchun alohida chizma (blueprint) yuklang, AI tahlili orqali xonalar rejasini yarating va interaktiv 3D maketni ko&apos;ring.
          </p>
        </div>

        {/* Floor Stats (Visible only when built) */}
        {builtFloors[activeFloor] && (
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
        )}
      </div>

      {/* Floor Selection Tabs */}
      <div className="flex gap-2 p-1.5 rounded-2xl bg-slate-100/50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 w-fit">
        {floors.map((fl) => {
          const active = fl === activeFloor
          const isBuilt = !!builtFloors[fl]
          return (
            <button
              key={fl}
              onClick={() => {
                setActiveFloor(fl)
                setSelectedRoomNumber(null)
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                active
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5'
              }`}
            >
              <Layers3 size={14} className={active ? 'text-white' : 'text-cyan-500'} />
              {fl}-qavat
              {isBuilt && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
              )}
            </button>
          )
        })}
      </div>

      {/* Main interactive panel */}
      {!builtFloors[activeFloor] ? (
        <div className={`backdrop-blur-xl border rounded-[2rem] p-8 ${surfaceBg} min-h-[450px] flex flex-col items-center justify-center text-center`}>
          {!floorPreviews[activeFloor] ? (
            <div className="max-w-md w-full">
              <div className="relative w-24 h-24 mx-auto mb-6 shrink-0">
                <img 
                  src="https://img.icons8.com/3d-fluency/94/upload.png" 
                  alt="Upload blueprint" 
                  className="w-full h-full object-contain" 
                />
              </div>
              <h2 className={`text-xl font-black ${textStrong}`}>{activeFloor}-qavat Blueprintini Yuklang</h2>
              <p className={`text-xs mt-2 mb-6 ${textMuted}`}>
                {activeFloor}-qavatdagi xonalar joylashuvi va rejasini tahlil qilish uchun uning chizmasini (JPEG/PNG) yuklang.
              </p>
              
              <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-black uppercase tracking-wider tracking-widest transition-all duration-300 shadow-lg shadow-cyan-500/20 active:scale-95">
                <Upload size={16} />
                Chizmani Tanlash
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="max-w-xl w-full space-y-6">
              <div className="relative rounded-2xl overflow-hidden border border-white/10 max-h-60 bg-black/20">
                <img src={floorPreviews[activeFloor]} alt="Blueprint preview" className="w-full h-auto object-cover max-h-60" />
                {floorAnalyzing[activeFloor] && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white">
                    <div className="relative w-16 h-16 mb-4 animate-spin">
                      <img src="https://img.icons8.com/3d-fluency/94/settings.png" alt="Analyzing" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-widest text-cyan-400">AI {activeFloor}-qavatni Tahlil Qilmoqda...</p>
                    <div className="w-full max-w-xs bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
                      <motion.div 
                        className="bg-cyan-500 h-full" 
                        initial={{ width: 0 }}
                        animate={{ width: `${floorProgress[activeFloor] || 0}%` }}
                        transition={{ duration: 0.1 }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 mt-2">{floorProgress[activeFloor] || 0}% yakunlandi</span>
                  </div>
                )}
              </div>

              {!floorAnalyzing[activeFloor] && (
                <div className="space-y-4">
                  {!floorStructures[activeFloor] ? (
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={resetFloorModel}
                        className={`px-5 py-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all ${
                          isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-white/5 hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        Qayta yuklash
                      </button>
                      <button
                        onClick={startAIAnalysis}
                        className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                      >
                        <Cpu size={16} />
                        AI Tahlilni Boshlash
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className={`p-5 rounded-2xl border text-left ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
                      }`}>
                        <div className="flex items-center gap-2 text-emerald-400 mb-4 font-bold text-sm">
                           <CheckCircle2 size={16} />
                           Tahlil muvaffaqiyatli yakunlandi!
                        </div>
                        <p className={`text-xs ${textMuted} mb-3`}>AI chizmadan quyidagi bino tarkibini aniqladi:</p>
                        <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-wider">Aniqlangan xonalar soni</p>
                          <p className="text-2xl font-black mt-1">{floorStructures[activeFloor]?.length} ta xona</p>
                        </div>
                      </div>

                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={resetFloorModel}
                          className={`px-5 py-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all ${
                            isLight ? 'border-slate-200 hover:bg-slate-50' : 'border-white/5 hover:bg-white/5 text-slate-300'
                          }`}
                        >
                          Qayta yuklash
                        </button>
                        <button
                          onClick={build3DModel}
                          className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-lg shadow-purple-500/20 flex items-center gap-2"
                        >
                          3D Modelni Qurish
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Three.js interactive canvas wrapper */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative min-h-[500px] rounded-[2rem] border backdrop-blur-xl overflow-hidden ${surfaceBg}`}
          >
            {/* Status badges */}
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

            {/* Back button */}
            <button
              onClick={resetFloorModel}
              className={`absolute top-6 right-6 z-10 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                isLight ? 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <RotateCcw size={12} />
              Qayta Tahlil qilish
            </button>

            {/* 3D Canvas */}
            <canvas ref={canvasRef} className="w-full h-[500px] block outline-none cursor-grab active:cursor-grabbing" />

            {/* Hover overlay hint */}
            <div className="absolute bottom-6 left-6 pointer-events-none">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${textMuted} flex items-center gap-2`}>
                <MousePointer2 size={12} />
                Qavatni aylantirish uchun sudrang, tanlash uchun xonani bosing.
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
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h2 className={`text-2xl font-black tracking-tight ${textStrong}`}>Xona #{selectedRoomData.number}</h2>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{activeFloor}-qavat</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${cardBg}`}>
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
                  
                  {/* Student occupancy detail */}
                  {selectedRoomData.students.length > 0 && (
                    <div className="md:col-span-3">
                      <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${textMuted}`}>Xonadagi Talabalar Ro&apos;yxati</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedRoomData.students.map((student) => (
                          <div key={student.id} className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${cardBg}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold text-xs uppercase">
                                {student.name.slice(0, 2)}
                              </div>
                              <p className={`text-sm font-bold ${textStrong}`}>{student.name}</p>
                            </div>
                            <Link
                              href={`/admin/foydalanuvchilar?id=${student.id}`}
                              className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-all border border-cyan-500/20"
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
        </div>
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
