import { redirect } from 'next/navigation'

// The dekan student directory and this admin "Foydalanuvchilar" re-export had
// grown into near-duplicates. "Talabalar" is now the single faculty student
// page (it carries the edit / delete actions this page used to own), so this
// route only survives as a redirect for old bookmarks and links.
export default function DekanFoydalanuvchilarRedirect() {
  redirect('/dekan/talabalar')
}
