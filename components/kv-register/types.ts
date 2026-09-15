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
  faculty: '',
  direction: '',
  course: '',
  group: '',
  hemisStudentId: '',
}
