export type FacultyStudentRow = {
  id: string
  full_name: string
  gender: string | null
  room_number: string | null
  course: number | null
  direction: string | null
  // 'user' — a real, already-registered account (role='talaba').
  // 'permit' — an approved yo'llanma whose person hasn't self-registered
  // yet; `id` is the permit_requests row's id, not a users id. Assigning a
  // room to one of these writes to permit_requests.room_number, which
  // app/api/student/register/route.ts reads to seed the room the moment
  // that person actually registers.
  source: 'user' | 'permit'
}
