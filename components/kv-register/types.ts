// KV-talaba (off-campus student) self-registration wizard state — a smaller,
// standalone cousin of components/register/types.ts. No permit/passport/
// jshshir fields here (see app/kv-royxatdan-otish/page.tsx for why), just
// what the KV form itself collects, split one field per input the way
// components/register/Step2Name.tsx does for F.I.Sh.
export interface KvRegisterData {
  lastName: string
  firstName: string
  middleName: string
  noMiddleName: boolean
  email: string
  phone: string
  gender: '' | 'male' | 'female'
  // Drives which visa/propiska module (features/foreign-docs) the account
  // unlocks after registration — see resolveDocsMode: 'foreign' needs
  // `country` set, 'uz' needs `region` set. Neither is dorm-dependent, so a
  // KV-talaba (never assigned a room) is covered the same as a dorm student.
  citizenship: '' | 'uz' | 'foreign'
  region: string
  country: string
  faculty: string
  direction: string
  course: string
  group: string
  hemisStudentId: string
}

export const initialKvData: KvRegisterData = {
  lastName: '',
  firstName: '',
  middleName: '',
  noMiddleName: false,
  email: '',
  phone: '',
  gender: '',
  citizenship: '',
  region: '',
  country: '',
  faculty: '',
  direction: '',
  course: '',
  group: '',
  hemisStudentId: '',
}
