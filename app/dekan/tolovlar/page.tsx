// Payment review (receipt approve/reject + AI check) folded in from the
// retired /admin panel. The page body calls /api/admin/payments, which is
// already scoped to the caller's own faculty for a dekan — same re-export
// pattern as /dekan/murojaatlar and /dekan/xodimlar.
export { default } from '@/app/admin/tolovlar/page'
