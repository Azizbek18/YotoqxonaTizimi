// Payment review (receipt approve/reject + AI check) for the dekan — the same
// page body the tarbiyachi uses at /tarbiyachi/tolovlar. The shared client
// api picks /api/dekan/payments by the /dekan URL prefix, so it is scoped to
// the dekan's own faculty.
export { default } from '@/app/admin/tolovlar/page'
