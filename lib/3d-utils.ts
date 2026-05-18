import * as BABYLON from 'babylonjs'

export interface Room3D {
  id: string
  number: number
  floorNumber: number
  capacity: number
  occupied: number
  status: 'empty' | 'occupied' | 'full'
  color?: BABYLON.Color3
}

export interface Floor3D {
  id: string
  number: number
  name: string
  rooms: Room3D[]
}

// Sample data generator
export const generateSampleFloors = (): Floor3D[] => {
  const floors: Floor3D[] = []

  for (let floorNum = 1; floorNum <= 3; floorNum++) {
    const rooms: Room3D[] = []
    for (let roomNum = 1; roomNum <= 10; roomNum++) {
      const occupied = Math.floor(Math.random() * 4)
      rooms.push({
        id: `room-${floorNum}-${roomNum}`,
        number: roomNum,
        floorNumber: floorNum,
        capacity: 4,
        occupied,
        status: occupied === 0 ? 'empty' : occupied === 4 ? 'full' : 'occupied',
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

// Create a 3D room
export const createRoom = (
  scene: BABYLON.Scene,
  room: Room3D,
  posX: number,
  posY: number,
  posZ: number,
  width: number = 1.5,
  height: number = 1,
  depth: number = 1
): BABYLON.Mesh => {
  const box = BABYLON.MeshBuilder.CreateBox(
    `room-${room.id}`,
    { width, height, depth },
    scene
  )
  box.position = new BABYLON.Vector3(posX, posY, posZ)

  // Determine color based on status
  let color: BABYLON.Color3
  if (room.status === 'empty') {
    color = new BABYLON.Color3(0.2, 0.8, 0.2) // Green
  } else if (room.status === 'full') {
    color = new BABYLON.Color3(0.8, 0.2, 0.2) // Red
  } else {
    color = new BABYLON.Color3(1, 0.8, 0) // Yellow
  }

  const material = new BABYLON.StandardMaterial(`mat-${room.id}`, scene)
  material.diffuse = color
  material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2)
  box.material = material

    // Store room data on mesh
    ; (box as any).roomData = room

  return box
}

// Create a floor layout
export const createFloorLayout = (
  scene: BABYLON.Scene,
  floor: Floor3D,
  startY: number
): BABYLON.Mesh[] => {
  const meshes: BABYLON.Mesh[] = []
  const roomsPerRow = 5
  const roomWidth = 1.5
  const roomHeight = 1
  const roomDepth = 1
  const spacing = 0.2

  // Create ground for floor
  const ground = BABYLON.MeshBuilder.CreateGround(
    `ground-floor-${floor.number}`,
    { width: 10, height: 8 },
    scene
  )
  ground.position.y = startY
  const groundMat = new BABYLON.StandardMaterial(`groundMat-${floor.number}`, scene)
  groundMat.diffuse = new BABYLON.Color3(0.3, 0.3, 0.4)
  groundMat.alpha = 0.8
  ground.material = groundMat
  meshes.push(ground)

  // Create rooms
  floor.rooms.forEach((room, index) => {
    const row = Math.floor(index / roomsPerRow)
    const col = index % roomsPerRow

    const posX = col * (roomWidth + spacing) - (roomsPerRow * (roomWidth + spacing)) / 2 + roomWidth / 2
    const posY = startY + roomHeight / 2 + 0.1
    const posZ = row * (roomDepth + spacing) - 1

    const roomMesh = createRoom(scene, room, posX, posY, posZ, roomWidth, roomHeight, roomDepth)
    meshes.push(roomMesh)
  })

  return meshes
}

// Create walls for visual separation
export const createWalls = (scene: BABYLON.Scene, startY: number): BABYLON.Mesh[] => {
  const meshes: BABYLON.Mesh[] = []
  const wallHeight = 2

  // Wall 1: Back wall
  const backWall = BABYLON.MeshBuilder.CreateBox(
    'backWall',
    { width: 12, height: wallHeight, depth: 0.1 },
    scene
  )
  backWall.position = new BABYLON.Vector3(0, startY + wallHeight / 2, -3)
  const wallMat = new BABYLON.StandardMaterial('wallMat', scene)
  wallMat.diffuse = new BABYLON.Color3(0.7, 0.7, 0.7)
  backWall.material = wallMat
  meshes.push(backWall)

  // Wall 2: Front wall
  const frontWall = BABYLON.MeshBuilder.CreateBox(
    'frontWall',
    { width: 12, height: wallHeight, depth: 0.1 },
    scene
  )
  frontWall.position = new BABYLON.Vector3(0, startY + wallHeight / 2, 3)
  frontWall.material = wallMat
  meshes.push(frontWall)

  return meshes
}
