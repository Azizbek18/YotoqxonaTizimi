type Resident = {
  id: string
  room_number?: string | null
  dorm_id?: string | null
  block?: string | null
  assigned_floor?: number | null
  status?: string | null
}

/** Room numbers repeat across buildings and across floors in blocked dorms. */
export function isRoommate(resident: Resident, selected: Resident): boolean {
  if (!selected.room_number || !selected.dorm_id || selected.status !== 'active') return false
  if (selected.block && selected.assigned_floor == null) return false
  return resident.id !== selected.id
    && resident.status === 'active'
    && resident.room_number === selected.room_number
    && resident.dorm_id === selected.dorm_id
    && (resident.block ?? null) === (selected.block ?? null)
    && (!selected.block || resident.assigned_floor === selected.assigned_floor)
}
