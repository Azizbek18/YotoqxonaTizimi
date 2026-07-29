import { createClient } from '@supabase/supabase-js'
import { errorMessage, isPermissionDeniedError } from './verify-remote-helpers.mjs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceRoleKey) {
  throw new Error('Supabase environment variables are missing')
}

const service = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const anon = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const checks = []

async function check(name, run) {
  try {
    await run()
    checks.push({ name, ok: true })
  } catch (error) {
    checks.push({
      name,
      ok: false,
      message: errorMessage(error),
    })
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertPermissionDenied(error, label) {
  assert(Boolean(error), `${label} request unexpectedly succeeded`)
  const message = errorMessage(error)
  assert(
    isPermissionDeniedError(error),
    `${label} request failed for an unrelated reason: ${message}`,
  )
}

await check('Supabase API keys are accepted', async () => {
  const authSettingsUrl = new URL('/auth/v1/settings', url)
  const [anonResponse, serviceResponse] = await Promise.all([
    fetch(authSettingsUrl, { headers: { apikey: anonKey } }),
    fetch(authSettingsUrl, { headers: { apikey: serviceRoleKey } }),
  ])
  assert(anonResponse.ok, `anonymous API key was rejected (${anonResponse.status})`)
  assert(serviceResponse.ok, `service-role API key was rejected (${serviceResponse.status})`)
})

await check('app_settings schema and constraints', async () => {
  const { data, error } = await service
    .from('app_settings')
    .select('id,monthly_fee,yearly_contract_fee,default_room_capacity,floor_count,max_upload_size_mb,warning_threshold')
    .eq('id', 1)
    .single()

  if (error) throw error
  assert(Number.isInteger(data.monthly_fee) && data.monthly_fee >= 1, 'monthly_fee is invalid')
  assert(Number.isInteger(data.yearly_contract_fee) && data.yearly_contract_fee >= 1, 'yearly_contract_fee is invalid')
  assert(data.yearly_contract_fee % data.monthly_fee === 0, 'yearly fee is not a multiple of monthly fee')
  assert(Number.isInteger(data.default_room_capacity) && data.default_room_capacity >= 1 && data.default_room_capacity <= 20, 'room capacity is invalid')
  assert(Number.isInteger(data.floor_count) && data.floor_count >= 1 && data.floor_count <= 50, 'floor count is invalid')
  assert(Number.isInteger(data.max_upload_size_mb) && data.max_upload_size_mb >= 1 && data.max_upload_size_mb <= 50, 'upload limit is invalid')
  assert(Number.isInteger(data.warning_threshold) && data.warning_threshold >= 1 && data.warning_threshold <= 20, 'warning threshold is invalid')
})

await check('latest table columns are deployed', async () => {
  const probes = [
    service.from('staff').select('id,created_by,staff_id').limit(1),
    service.from('tolovlar').select('id,transaction_id_normalized').limit(1),
    service.from('payment_receipt_transactions').select('receipt_hash,transaction_id_normalized').limit(1),
    service.from('floor_room_layout').select('id,floor_number,room_number,side,position,size').limit(1),
  ]
  const results = await Promise.all(probes)
  for (const result of results) {
    if (result.error) throw result.error
  }
})

await check('anonymous users cannot read sensitive tables', async () => {
  const sensitiveTables = ['users', 'staff', 'tolovlar', 'permit_requests']
  for (const table of sensitiveTables) {
    const { data, error, count } = await anon
      .from(table)
      .select('id', { count: 'exact' })
      .limit(1)

    if (error) {
      throw new Error(`anonymous read probe failed for ${table}: ${errorMessage(error)}`)
    }
    assert((data?.length ?? 0) === 0, `anonymous read returned rows from ${table}`)
    assert((count ?? 0) === 0, `anonymous read exposed the row count of ${table}`)
  }
})

await check('default function execute is not exposed to anonymous users', async () => {
  const { error } = await anon.rpc('is_active_staff_role', {
    required_roles: ['admin'],
  })
  assertPermissionDenied(error, 'anonymous function execution')
})

await check('atomic payment and duty RPCs are deployed and service-only', async () => {
  const paymentArgs = {
    p_student_id: '00000000-0000-0000-0000-000000000000',
    p_student_name: '',
    p_months: [],
    p_amounts: [],
    p_year: 0,
    p_receipt_url: '',
    p_receipt_hash: '',
    p_batch_id: '00000000-0000-0000-0000-000000000000',
    p_transaction_id: '',
    p_transaction_id_normalized: '',
  }
  const dutyArgs = {
    p_creator_id: '00000000-0000-0000-0000-000000000000',
    p_floor: 0,
    p_gender: '',
    p_faculty: '',
    p_text: '{}',
  }

  const [paymentService, dutyService, paymentAnon, dutyAnon] = await Promise.all([
    service.rpc('submit_payment_batch_atomic', paymentArgs),
    service.rpc('upsert_floor_duty_schedule', dutyArgs),
    anon.rpc('submit_payment_batch_atomic', paymentArgs),
    anon.rpc('upsert_floor_duty_schedule', dutyArgs),
  ])

  assert(paymentService.error?.code === '22023', `atomic payment RPC validation is missing: ${errorMessage(paymentService.error)}`)
  assert(dutyService.error?.code === '22023', `duty schedule RPC validation is missing: ${errorMessage(dutyService.error)}`)
  assertPermissionDenied(paymentAnon.error, 'anonymous atomic payment RPC')
  assertPermissionDenied(dutyAnon.error, 'anonymous duty schedule RPC')
})

const failed = checks.filter((item) => !item.ok)
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.message ? `: ${item.message}` : ''}`)
}

if (failed.length > 0) {
  process.exitCode = 1
} else {
  console.log(`Remote Supabase end-state verification passed (${checks.length}/${checks.length}).`)
}
