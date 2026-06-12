'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  Building2,
  ListFilter,
  MousePointer2,
  Move3D,
  RotateCcw,
  Search,
  ZoomIn,
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  Floor3D,
  Room3D,
  RoomOccupancySnapshot,
  generateSampleFloors,
  getFloorDimensions,
  getRoomStatusClasses,
} from '@/lib/3d-utils'

interface RoomViewer3DProps {
  roomSnapshots?: RoomOccupancySnapshot[]
  onRoomSelect?: (room: Room3D, floor: Floor3D) => void
  onFloorChange?: (floor: Floor3D) => void
}

type RoomMesh = THREE.Mesh<
  THREE.BoxGeometry,
  THREE.MeshStandardMaterial
> & {
  userData: {
    room: Room3D
    baseColor: THREE.ColorRepresentation
    accentColor: THREE.ColorRepresentation
  }
}

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 30, 4.5)
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)
const FLOOR_CAMERA_HEIGHT = 28
const FLOOR_CAMERA_DEPTH = 9
const ROOM_CAMERA_HEIGHT = 18
const ROOM_CAMERA_DEPTH = 7
const ROOM_CAMERA_X_OFFSET = 0.4
const ROOM_HEIGHT_SCALE = 0.72

const getFloorCameraPosition = (elevation: number) =>
  new THREE.Vector3(0, elevation + FLOOR_CAMERA_HEIGHT, FLOOR_CAMERA_DEPTH)

const getRoomCameraPosition = (room: Room3D, floor: Floor3D) =>
  new THREE.Vector3(
    room.position.x + ROOM_CAMERA_X_OFFSET,
    floor.elevation + ROOM_CAMERA_HEIGHT,
    room.position.z + ROOM_CAMERA_DEPTH
  )

export default function RoomViewer3D({
  roomSnapshots = [],
  onRoomSelect,
  onFloorChange,
}: RoomViewer3DProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const pointerRef = useRef(new THREE.Vector2())
  const roomMeshesRef = useRef<RoomMesh[]>([])
  const floorGroupsRef = useRef<Map<number, THREE.Group>>(new Map())
  const hoveredMeshRef = useRef<RoomMesh | null>(null)
  const selectedMeshRef = useRef<RoomMesh | null>(null)
  const desiredCameraPosRef = useRef(DEFAULT_CAMERA_POSITION.clone())
  const desiredTargetRef = useRef(DEFAULT_CAMERA_TARGET.clone())
  const focusFloorRef = useRef<(floorNumber: number) => void>(() => {})
  const clearSelectionRef = useRef<() => void>(() => {})
  const resetViewRef = useRef<() => void>(() => {})

  const floors = useMemo(() => generateSampleFloors(roomSnapshots), [roomSnapshots])
  const [selectedFloor, setSelectedFloor] = useState<number>(floors[0]?.number ?? 1)
  const [selectedRoom, setSelectedRoom] = useState<Room3D | null>(null)
  const [isSceneReady, setIsSceneReady] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'empty' | 'occupied' | 'full'>('all')
  const [roomQuery, setRoomQuery] = useState('')

  const resolvedSelectedFloor = useMemo(
    () => (floors.some((floor) => floor.number === selectedFloor) ? selectedFloor : (floors[0]?.number ?? 1)),
    [floors, selectedFloor]
  )

  const resolvedSelectedRoom = useMemo(
    () =>
      selectedRoom && floors.some((floor) => floor.rooms.some((room) => room.id === selectedRoom.id))
        ? selectedRoom
        : null,
    [floors, selectedRoom]
  )

  const activeFloor = useMemo(
    () => floors.find((floor) => floor.number === resolvedSelectedFloor) ?? floors[0],
    [floors, resolvedSelectedFloor]
  )

  const displayedRooms = useMemo(() => {
    const normalizedQuery = roomQuery.trim().toLowerCase()

    return (activeFloor?.rooms ?? []).filter((room) => {
      const matchesStatus = statusFilter === 'all' || room.status === statusFilter
      const matchesRoom =
        !normalizedQuery || String(room.number).toLowerCase().includes(normalizedQuery)

      return matchesStatus && matchesRoom
    })
  }, [activeFloor, roomQuery, statusFilter])

  const floorStats = useMemo(() => {
    const rooms = activeFloor?.rooms ?? []

    return {
      total: rooms.length,
      empty: rooms.filter((room) => room.status === 'empty').length,
      occupied: rooms.filter((room) => room.status === 'occupied').length,
      full: rooms.filter((room) => room.status === 'full').length,
    }
  }, [activeFloor])

  useEffect(() => {
    const host = viewportRef.current
    if (!host || floors.length === 0) return

    const floorGroups = floorGroupsRef.current
    const roomMeshes = roomMeshesRef.current
    const maxRoomsPerSide = floors.reduce(
      (max, floor) => Math.max(max, Math.ceil(floor.rooms.length / 2)),
      1
    )

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#08101f')
    scene.fog = new THREE.Fog('#08101f', 28, 60)
    sceneRef.current = scene

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer
    host.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(
      42,
      host.clientWidth / Math.max(host.clientHeight, 1),
      0.1,
      200
    )
    camera.position.copy(DEFAULT_CAMERA_POSITION)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = true
    controls.minDistance = 14
    controls.maxDistance = 46
    controls.minPolarAngle = 0.1
    controls.maxPolarAngle = 0.55
    controls.maxAzimuthAngle = Math.PI / 4
    controls.minAzimuthAngle = -Math.PI / 4
    controls.target.copy(DEFAULT_CAMERA_TARGET)
    controlsRef.current = controls

    scene.add(new THREE.AmbientLight('#b7c9ff', 1.8))

    const hemi = new THREE.HemisphereLight('#dbeafe', '#0f172a', 1.4)
    hemi.position.set(0, 18, 0)
    scene.add(hemi)

    const sun = new THREE.DirectionalLight('#ffffff', 2.2)
    sun.position.set(12, 18, 8)
    sun.castShadow = true
    sun.shadow.mapSize.width = 1024
    sun.shadow.mapSize.height = 1024
    scene.add(sun)

    const glow = new THREE.PointLight('#8b5cf6', 22, 40, 2)
    glow.position.set(0, 10, 0)
    scene.add(glow)

    const root = new THREE.Group()
    scene.add(root)

    const dimensions = getFloorDimensions(maxRoomsPerSide)
    const floorBase = new THREE.Mesh(
      new THREE.BoxGeometry(dimensions.width + 5, 0.4, dimensions.depth + 5),
      new THREE.MeshStandardMaterial({
        color: '#0b1327',
        metalness: 0.15,
        roughness: 0.9,
      })
    )
    floorBase.position.set(0, -0.35, 0)
    floorBase.receiveShadow = true
    root.add(floorBase)

    const halo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 11.5, 0.08, 60),
      new THREE.MeshBasicMaterial({
        color: '#2563eb',
        transparent: true,
        opacity: 0.16,
      })
    )
    halo.rotation.x = Math.PI / 2
    halo.position.y = -0.12
    root.add(halo)

    const makeTextSprite = (label: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 128
      const context = canvas.getContext('2d')
      if (!context) return null

      context.fillStyle = 'rgba(8,16,31,0.88)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.strokeStyle = 'rgba(148,163,184,0.45)'
      context.lineWidth = 6
      context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12)
      context.fillStyle = '#e2e8f0'
      context.font = 'bold 48px Trebuchet MS'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(label, canvas.width / 2, canvas.height / 2)

      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
      })

      const sprite = new THREE.Sprite(material)
      sprite.scale.set(1.5, 0.72, 1)
      return sprite
    }

    const updateMeshVisualState = (mesh: RoomMesh, state: 'default' | 'hover' | 'selected') => {
      const material = mesh.material
      material.color.set(mesh.userData.baseColor)
      material.emissive.set(mesh.userData.baseColor)

      if (state === 'selected') {
        material.emissiveIntensity = 0.5
        mesh.scale.setScalar(1.07)
        return
      }

      if (state === 'hover') {
        material.emissiveIntensity = 0.28
        mesh.scale.setScalar(1.03)
        return
      }

      material.emissiveIntensity = 0.12
      mesh.scale.setScalar(1)
    }

    const clearSelection = () => {
      if (selectedMeshRef.current) {
        updateMeshVisualState(selectedMeshRef.current, 'default')
      }

      selectedMeshRef.current = null
      setSelectedRoom(null)
    }
    clearSelectionRef.current = clearSelection

    const focusFloor = (floorNumber: number) => {
      floorGroups.forEach((group, currentFloor) => {
        const isActive = currentFloor === floorNumber
        group.visible = isActive
        group.position.y = 0
        group.scale.setScalar(1)

        group.traverse((child) => {
          if ('material' in child) {
            const candidate = child as THREE.Mesh
            const materials = Array.isArray(candidate.material)
              ? candidate.material
              : candidate.material
                ? [candidate.material]
                : []

            materials.forEach((material) => {
              if ('opacity' in material) {
                material.transparent = true
                material.opacity = 1
              }
            })
          }
        })
      })

      const floor = floors.find((item) => item.number === floorNumber)
      const elevation = floor?.elevation ?? 0
      desiredTargetRef.current.set(0, elevation, 0)
      desiredCameraPosRef.current.copy(getFloorCameraPosition(elevation))
    }
    focusFloorRef.current = focusFloor

    const resetView = () => {
      clearSelection()
      setSelectedFloor(floors[0]?.number ?? 1)
      desiredCameraPosRef.current.copy(DEFAULT_CAMERA_POSITION)
      desiredTargetRef.current.copy(DEFAULT_CAMERA_TARGET)
    }
    resetViewRef.current = resetView

    floors.forEach((floor) => {
      const group = new THREE.Group()
      group.userData.floorNumber = floor.number
      root.add(group)
      floorGroups.set(floor.number, group)

      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(dimensions.width, 0.18, dimensions.depth),
        new THREE.MeshStandardMaterial({
          color: '#1b2942',
          metalness: 0.08,
          roughness: 0.96,
        })
      )
      slab.position.set(0, floor.elevation, 0)
      slab.receiveShadow = true
      group.add(slab)

      const activePlate = new THREE.Mesh(
        new THREE.BoxGeometry(dimensions.width - 0.35, 0.04, dimensions.depth - 0.35),
        new THREE.MeshStandardMaterial({
          color: '#0f172a',
          emissive: '#164e63',
          emissiveIntensity: 0.16,
          transparent: true,
          opacity: 0.92,
          metalness: 0.02,
          roughness: 1,
        })
      )
      activePlate.position.set(0, floor.elevation + 0.12, 0)
      group.add(activePlate)

      const corridor = new THREE.Mesh(
        new THREE.BoxGeometry(dimensions.corridorWidth, 0.12, dimensions.depth - 0.7),
        new THREE.MeshStandardMaterial({
          color: '#475569',
          metalness: 0.02,
          roughness: 0.92,
        })
      )
      corridor.position.set(0, floor.elevation + 0.12, 0)
      group.add(corridor)

      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(dimensions.width, 0.18, dimensions.depth)),
        new THREE.LineBasicMaterial({ color: '#64748b', transparent: true, opacity: 0.35 })
      )
      outline.position.copy(slab.position)
      group.add(outline)

      floor.rooms.forEach((room) => {
        const statusUi = getRoomStatusClasses(room.status)
        const roomHeight = room.size.height * ROOM_HEIGHT_SCALE
        const geometry = new THREE.BoxGeometry(room.size.width, roomHeight, room.size.depth)
        const material = new THREE.MeshStandardMaterial({
          color: statusUi.color,
          emissive: statusUi.color,
          emissiveIntensity: 0.1,
          metalness: 0.08,
          roughness: 0.68,
        })
        const mesh = new THREE.Mesh(geometry, material) as RoomMesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.position.set(room.position.x, floor.elevation + roomHeight / 2 + 0.14, room.position.z)
        mesh.userData = {
          room,
          baseColor: statusUi.color,
          accentColor: statusUi.accent,
        }

        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0.28 })
        )
        mesh.add(edges)

        const label = makeTextSprite(String(room.number))
        if (label) {
          label.position.set(0, roomHeight / 2 + 0.32, 0)
          mesh.add(label)
        }

        roomMeshes.push(mesh)
        group.add(mesh)
      })
    })

    const pickRoom = (event: MouseEvent | PointerEvent) => {
      if (!rendererRef.current || !cameraRef.current) return null

      const bounds = rendererRef.current.domElement.getBoundingClientRect()
      pointerRef.current.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      pointerRef.current.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1

      raycasterRef.current.setFromCamera(pointerRef.current, cameraRef.current)
      const intersections = raycasterRef.current.intersectObjects(roomMeshes, false)
      return intersections[0]?.object as RoomMesh | undefined
    }

    const handlePointerMove = (event: PointerEvent) => {
      const mesh = pickRoom(event) ?? null

      if (hoveredMeshRef.current && hoveredMeshRef.current !== selectedMeshRef.current) {
        updateMeshVisualState(hoveredMeshRef.current, 'default')
      }

      hoveredMeshRef.current = mesh

      if (mesh && mesh !== selectedMeshRef.current) {
        updateMeshVisualState(mesh, 'hover')
      }

      renderer.domElement.style.cursor = mesh ? 'pointer' : 'grab'
    }

    const handlePointerLeave = () => {
      if (hoveredMeshRef.current && hoveredMeshRef.current !== selectedMeshRef.current) {
        updateMeshVisualState(hoveredMeshRef.current, 'default')
      }

      hoveredMeshRef.current = null
      renderer.domElement.style.cursor = 'grab'
    }

    const handleClick = (event: MouseEvent) => {
      const mesh = pickRoom(event)
      if (!mesh) return

      if (selectedMeshRef.current && selectedMeshRef.current !== mesh) {
        updateMeshVisualState(selectedMeshRef.current, 'default')
      }

      selectedMeshRef.current = mesh
      updateMeshVisualState(mesh, 'selected')

      const room = mesh.userData.room
      const floor = floors.find((item) => item.number === room.floorNumber)
      if (!floor) return

      setSelectedRoom(room)
      setSelectedFloor(floor.number)
      onRoomSelect?.(room, floor)
      onFloorChange?.(floor)

      focusFloor(floor.number)
      desiredTargetRef.current.set(room.position.x, floor.elevation, room.position.z)
      desiredCameraPosRef.current.copy(getRoomCameraPosition(room, floor))
    }

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = host.clientWidth
      const nextHeight = host.clientHeight

      renderer.setSize(nextWidth, nextHeight)
      camera.aspect = nextWidth / Math.max(nextHeight, 1)
      camera.updateProjectionMatrix()
    })
    resizeObserver.observe(host)

    renderer.domElement.addEventListener('pointermove', handlePointerMove)
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave)
    renderer.domElement.addEventListener('click', handleClick)

    const tick = () => {
      camera.position.lerp(desiredCameraPosRef.current, 0.08)
      controls.target.lerp(desiredTargetRef.current, 0.08)
      controls.update()
      renderer.render(scene, camera)
    }

    renderer.setAnimationLoop(tick)
    requestAnimationFrame(() => {
      setIsSceneReady(true)
    })

    return () => {
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointermove', handlePointerMove)
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave)
      renderer.domElement.removeEventListener('click', handleClick)
      renderer.setAnimationLoop(null)
      controls.dispose()

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()

          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            if ('map' in material && material.map) {
              material.map.dispose()
            }
            material.dispose()
          })
        }

        if (object instanceof THREE.Sprite) {
          object.material.map?.dispose()
          object.material.dispose()
        }
      })

      renderer.dispose()
      roomMeshesRef.current = []
      floorGroups.clear()
      hoveredMeshRef.current = null
      selectedMeshRef.current = null
      focusFloorRef.current = () => {}
      clearSelectionRef.current = () => {}
      resetViewRef.current = () => {}
      if (host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement)
      }
    }
  }, [floors, onFloorChange, onRoomSelect])

  useEffect(() => {
    if (!resolvedSelectedRoom) {
      if (selectedMeshRef.current) {
        selectedMeshRef.current.material.emissiveIntensity = 0.12
        selectedMeshRef.current.scale.setScalar(1)
      }
      selectedMeshRef.current = null
      return
    }

    const mesh = roomMeshesRef.current.find((item) => item.userData.room.id === resolvedSelectedRoom.id)
    if (mesh) {
      selectedMeshRef.current = mesh
    }
  }, [resolvedSelectedRoom])

  useEffect(() => {
    if (!isSceneReady) return
    focusFloorRef.current(resolvedSelectedFloor)
  }, [isSceneReady, resolvedSelectedFloor])

  const handleFloorChange = (floorNumber: number) => {
    setSelectedFloor(floorNumber)
    clearSelectionRef.current()

    const floor = floors.find((item) => item.number === floorNumber)
    if (floor) {
      onFloorChange?.(floor)
    }
  }

  const handleRoomCardSelect = (room: Room3D) => {
    const floor = floors.find((item) => item.number === room.floorNumber)
    if (!floor) return

    setSelectedFloor(floor.number)
    setSelectedRoom(room)
    onRoomSelect?.(room, floor)
    onFloorChange?.(floor)

    const mesh = roomMeshesRef.current.find((item) => item.userData.room.id === room.id)
    if (selectedMeshRef.current && selectedMeshRef.current !== mesh) {
      selectedMeshRef.current.material.emissiveIntensity = 0.12
      selectedMeshRef.current.scale.setScalar(1)
    }

    if (mesh) {
      selectedMeshRef.current = mesh
      mesh.material.emissiveIntensity = 0.5
      mesh.scale.setScalar(1.07)
    }

    desiredTargetRef.current.set(room.position.x, floor.elevation, room.position.z)
    desiredCameraPosRef.current.copy(getRoomCameraPosition(room, floor))
    focusFloorRef.current(floor.number)
    desiredTargetRef.current.set(room.position.x, floor.elevation, room.position.z)
    desiredCameraPosRef.current.copy(getRoomCameraPosition(room, floor))
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-white/10 bg-linear-to-br from-slate-900 to-slate-800">
      <div className="grid h-full grid-cols-1 gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-cyan-300" />
              <h3 className="font-bold text-white">Qavatlar</h3>
            </div>
            <button
              type="button"
              onClick={() => resetViewRef.current()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Qaytarish
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                onClick={() => handleFloorChange(floor.number)}
                className={`rounded-lg p-3 text-left text-sm font-semibold transition-all ${
                  selectedFloor === floor.number
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.25)]'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <div>{floor.name}</div>
                <div className="mt-1 text-xs opacity-80">{floor.rooms.length} xona</div>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Ko&apos;rinish</p>
            <p className="mt-2 text-sm font-semibold text-white">Alohida qavat 3D plani</p>
            <p className="mt-2 text-xs text-slate-400">
              Tanlangan qavat yakka ko&apos;rinadi. Xonani sahnadan yoki ro&apos;yxatdan tanlang.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 xl:grid-cols-2">
            <div className="rounded-xl border border-emerald-400/10 bg-emerald-500/10 p-3">
              <p className="text-xs text-emerald-300/80">Bo&apos;sh</p>
              <p className="mt-1 text-xl font-black text-white">{floorStats.empty}</p>
            </div>
            <div className="rounded-xl border border-amber-400/10 bg-amber-500/10 p-3">
              <p className="text-xs text-amber-300/80">Qisman</p>
              <p className="mt-1 text-xl font-black text-white">{floorStats.occupied}</p>
            </div>
            <div className="rounded-xl border border-rose-400/10 bg-rose-500/10 p-3">
              <p className="text-xs text-rose-300/80">To&apos;la</p>
              <p className="mt-1 text-xl font-black text-white">{floorStats.full}</p>
            </div>
            <div className="rounded-xl border border-cyan-400/10 bg-cyan-500/10 p-3">
              <p className="text-xs text-cyan-300/80">Jami</p>
              <p className="mt-1 text-xl font-black text-white">{floorStats.total}</p>
            </div>
          </div>
        </div>

        <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-white/10 bg-slate-950/60">
          {!isSceneReady && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 backdrop-blur"
            >
              <div className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
                <p className="font-medium text-slate-300">3D sahna yuklanmoqda...</p>
              </div>
            </motion.div>
          )}

          <div
            ref={viewportRef}
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at top, rgba(34,211,238,0.12), transparent 22%), linear-gradient(180deg, rgba(15,23,42,0.5), rgba(2,6,23,0.85))',
            }}
          />

          <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-sm rounded-xl border border-white/10 bg-slate-950/65 px-4 py-3 backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">3D Navigator</p>
              <h3 className="mt-2 text-xl font-black text-white">{activeFloor?.name}</h3>
              <p className="mt-2 text-sm text-slate-400">
                Qavatlar alohida ochiladi, xonalar yirik 3D bloklar sifatida ko&apos;rinadi.
              </p>
            </div>

            <div className="hidden flex-col gap-2 lg:flex">
              <div className="rounded-xl border border-white/10 bg-slate-950/65 px-4 py-3 text-right backdrop-blur">
                <p className="text-xs text-slate-400">Jami xonalar</p>
                <p className="text-2xl font-black text-white">{activeFloor?.rooms.length ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 rounded-xl border border-white/10 bg-slate-950/65 px-4 py-3 text-xs text-slate-300 backdrop-blur space-y-2">
            <div className="flex items-center gap-2">
              <MousePointer2 className="h-4 w-4 text-cyan-300" />
              Xonani tanlash: bosish
            </div>
            <div className="flex items-center gap-2">
              <Move3D className="h-4 w-4 text-cyan-300" />
              Sahna harakati: sichqoncha bilan aylantirish
            </div>
            <div className="flex items-center gap-2">
              <ZoomIn className="h-4 w-4 text-cyan-300" />
              Zoom: scroll
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-cyan-300" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-200">
              Xonalar ro&apos;yxati
            </h3>
          </div>

          <label className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={roomQuery}
              onChange={(event) => setRoomQuery(event.target.value)}
              placeholder="Xona raqami qidiring"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {(['all', 'empty', 'occupied', 'full'] as const).map((status) => {
              const label = status === 'all' ? 'Barchasi' : getRoomStatusClasses(status).label

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === status
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 space-y-2">
            {displayedRooms.length > 0 ? (
              displayedRooms.map((room) => {
                const ui = getRoomStatusClasses(room.status)
                const isActive = resolvedSelectedRoom?.id === room.id

                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => handleRoomCardSelect(room)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      isActive
                        ? 'border-cyan-400/40 bg-cyan-500/10'
                        : 'border-white/10 bg-slate-950/50 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">Xona #{room.number}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {room.wing === 'left' ? 'Chap blok' : "O'ng blok"} · {room.floorNumber}-qavat
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ui.badge}`}>
                        {ui.label}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                      <span>Bandlik</span>
                      <span>
                        {room.occupied}/{room.capacity}
                      </span>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-400">
                Bu filtr bo&apos;yicha xona topilmadi.
              </div>
            )}
          </div>

          <div className="mt-4 h-px bg-white/10" />

          {resolvedSelectedRoom ? (
            <div className="mt-4 flex flex-col gap-3">
              <h4 className="font-bold text-white">Tanlangan xona</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Xona raqami:</span>
                  <span className="font-bold text-white">{resolvedSelectedRoom.number}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Qavat:</span>
                  <span className="font-bold text-white">{resolvedSelectedRoom.floorNumber}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Tomon:</span>
                  <span className="font-bold text-white">
                    {resolvedSelectedRoom.wing === 'left' ? 'Chap blok' : "O'ng blok"}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Sig&apos;im:</span>
                  <span className="font-bold text-white">{resolvedSelectedRoom.capacity}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Band qismi:</span>
                  <span className="font-bold text-white">
                    {resolvedSelectedRoom.occupied}/{resolvedSelectedRoom.capacity}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">Holat:</span>
                  <span className={`font-bold ${resolvedSelectedRoom.status === 'empty' ? 'text-green-400' : resolvedSelectedRoom.status === 'full' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {getRoomStatusClasses(resolvedSelectedRoom.status).label}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400">Xona tafsilotlarini ko&apos;rish uchun</p>
              <p className="text-sm text-slate-400">3D sahnadagi yoki ro&apos;yxatdagi xonani tanlang</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
