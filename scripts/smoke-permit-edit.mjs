// Smoke test: editing a still-pending yo'llanma keeps its row, queue
// position and document — only the data changes.
//   node --env-file=.env.local scripts/smoke-permit-edit.mjs
import { createHmac } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000'
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const NUM = Date.now().toString().slice(-7) // 7 digits
const pass = (p) => `${p}${NUM}` // 2 letters + 7 digits — valid passport
const pin = (p) => `${p}${NUM}${'0'.repeat(14)}`.slice(0, 14) // 14 digits

const results = []
const check = (n, ok, d = '') => { results.push({ n, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`) }
const trash = []

// Mirrors lib/email-proof.ts issueEmailProof — the smoke run stands in for
// the applicant having typed the mailed code.
const emailProof = (email) => {
  const key = createHmac('sha256', process.env.EMAIL_PROOF_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY).update('email-proof:v1').digest()
  const payload = Buffer.from(JSON.stringify({ e: email.trim().toLowerCase(), x: Date.now() + 10 * 60_000 })).toString('base64url')
  return `${payload}.${createHmac('sha256', key).update(`proof|${payload}`).digest('base64url')}`
}

const mkPermit = async (over) => {
  const base = {
    passport_series: pass('AB'),
    jshshir: pin('9'),
    full_name: 'SMOKE Edit Talaba Ogli',
    email: `smoke-permit-edit-${NUM}@example.com`,
    phone: '+998900000000',
    gender: 'male',
    faculty: 'fizika',
    direction: 'Fizika',
    course: 1,
    permit_url: `2026/smoke-${NUM}.pdf`,
    status: 'pending',
    application_type: 'yollanma',
    ai_review: 'manual',
  }
  const { data, error } = await svc.from('permit_requests').insert({ ...base, ...over }).select('id, created_at').single()
  if (error) throw new Error(error.message)
  trash.push(data.id)
  return data
}

const statusOf = async (p) => {
  const res = await fetch(`${BASE}/api/permit-requests/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passportSeries: p.passport_series, jshshir: p.jshshir, email: p.email, applicationType: 'yollanma', emailProof: emailProof(p.email) }),
  })
  return (await res.json()).data
}

try {
  try { await fetch(`${BASE}/api/permit-requests`) } catch { throw new Error(`no dev server at ${BASE}`) }

  // Two earlier pending permits in the same faculty so ours sits at #3.
  const t0 = Date.now()
  await mkPermit({ passport_series: pass('AA'), jshshir: pin('1'), email: `smoke-a-${NUM}@x.uz`, created_at: new Date(t0 - 60000).toISOString() })
  await mkPermit({ passport_series: pass('AC'), jshshir: pin('2'), email: `smoke-c-${NUM}@x.uz`, created_at: new Date(t0 - 30000).toISOString() })
  const mine = await mkPermit({ created_at: new Date(t0).toISOString() })
  const identity = {
    passport_series: pass('AB'), jshshir: pin('9'),
    email: `smoke-permit-edit-${NUM}@example.com`,
  }

  const before = await statusOf(identity)
  check('has a queue position, >= 3 (two seeded ahead of it)', typeof before?.queuePosition === 'number' && before.queuePosition >= 3, `pos=${before?.queuePosition}`)

  // ---- edit in place: change the phone, no new document ----
  const fd = new FormData()
  fd.append('mode', 'edit')
  fd.append('passportSeries', identity.passport_series)
  fd.append('jshshir', identity.jshshir)
  fd.append('fullName', 'SMOKE Edit Talaba Ogli')
  fd.append('email', identity.email)
  fd.append('phone', '+998911112233')
  fd.append('gender', 'male')
  fd.append('faculty', 'fizika')
  fd.append('direction', 'Fizika')
  fd.append('course', '1')
  fd.append('emailProof', emailProof(identity.email))
  const res = await fetch(`${BASE}/api/permit-requests`, { method: 'POST', body: fd })
  const body = await res.json().catch(() => ({}))
  check('edit accepted, edited:true, no new row', res.status === 200 && body.edited === true && body.permitRequestId === mine.id, JSON.stringify(body))

  const row = (await svc.from('permit_requests').select('phone, permit_url, created_at, status').eq('id', mine.id).single()).data
  check('phone updated', row.phone === '+998911112233', row.phone)
  check('document kept (permit_url unchanged)', row.permit_url === `2026/smoke-${NUM}.pdf`, row.permit_url)
  check('created_at unchanged', row.created_at === mine.created_at, `${row.created_at} vs ${mine.created_at}`)
  check('still pending', row.status === 'pending', row.status)

  const after = await statusOf(identity)
  check('queue position UNCHANGED after the edit', after?.queuePosition === before?.queuePosition, `${before?.queuePosition} → ${after?.queuePosition}`)

  // ---- a plain re-submit (no mode=edit) on a pending row is still refused ----
  const fd2 = new FormData()
  for (const [k, v] of fd.entries()) if (k !== 'mode') fd2.append(k, v)
  const res2 = await fetch(`${BASE}/api/permit-requests`, { method: 'POST', body: fd2 })

  // ---- editing without an email proof is refused (passport/JShSHIR aren't secrets) ----
  const fd3 = new FormData()
  for (const [k, v] of fd.entries()) if (k !== 'emailProof') fd3.append(k, v)
  const res3 = await fetch(`${BASE}/api/permit-requests`, { method: 'POST', body: fd3 })
  check('edit without email proof → 401 EMAIL_PROOF_REQUIRED', res3.status === 401, `status=${res3.status}`)
  check('re-submit without edit intent is refused (never a silent overwrite)', [400, 409, 429].includes(res2.status), `status=${res2.status}`)
} catch (err) {
  check('EXCEPTION', false, err.message)
} finally {
  if (trash.length) await svc.from('permit_requests').delete().in('id', trash)
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}
