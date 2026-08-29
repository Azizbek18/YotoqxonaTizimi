// Payment review (receipt approve/reject + AI check). The tarbiyachi is
// responsible for every student in their faculty's dorm, so this is their
// page now — the body is shared with the (retired) admin panel and calls
// /api/tarbiyachi/payments, which is scoped to the caller's own faculty.
export { default } from '@/app/admin/tolovlar/page'
