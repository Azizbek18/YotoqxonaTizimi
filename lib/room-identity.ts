/** A physical room; blocked dorms repeat numbers on each block/floor. */
export function roomIdentity(row: {
  dorm_id?: string | null
  block?: string | null
  assigned_floor?: number | null
  floor_number?: number | null
  room_number?: string | null
}): string {
  return JSON.stringify([row.dorm_id ?? null, row.block ?? null,
    row.block ? row.assigned_floor ?? row.floor_number ?? null : null, row.room_number ?? null])
}
