export type RoomBlockSide = 'left' | 'right'
export type RoomBlockSize = 'small' | 'medium' | 'large'

export type RoomLayoutBlock = {
  roomNumber: string
  side: RoomBlockSide
  position: number
  size: RoomBlockSize
}
