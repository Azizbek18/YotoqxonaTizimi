// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import toast from 'react-hot-toast'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut } },
}))
vi.mock('@/lib/app-font', () => ({ appFont: { className: '', style: { fontFamily: 'sans-serif' } } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/components/theme/ThemeToggle', () => ({ default: () => null }))
vi.mock('@/components/DeveloperContactLink', () => ({ default: () => null }))

const { default: LoginPage } = await import('./page')

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('misol@gmail.com'), email)
  await user.type(screen.getByPlaceholderText('••••••••'), password)
  await user.click(screen.getByRole('button', { name: /Tizimga kirish/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  cleanup()
})

describe('LoginPage', () => {
  it('renders the email and password fields and the submit button', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('misol@gmail.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tizimga kirish/i })).toBeInTheDocument()
  })

  it('rejects submission with empty fields without calling Supabase', async () => {
    render(<LoginPage />)
    const form = screen.getByRole('button', { name: /Tizimga kirish/i }).closest('form')!
    // fireEvent.submit dispatches the 'submit' event directly, bypassing the
    // native required-field constraint validation that form.requestSubmit()
    // would enforce first (jsdom supports it) — this test targets the app's
    // own `!email || !password` guard inside handleLogin, not the browser's.
    await act(async () => {
      fireEvent.submit(form)
    })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith("Ma'lumotlarni to'liq kiriting")
  })

  it('shows a generic error for invalid credentials, never confirming which field was wrong', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } })
    render(<LoginPage />)
    await fillAndSubmit('student@example.com', 'wrong-password')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Email yoki parol noto'g'ri."))
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('normalizes the email (trim + lowercase) before calling Supabase', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ ok: true, role: null, reason: 'no_role' }),
    })
    render(<LoginPage />)
    await fillAndSubmit('  Student@Example.COM  ', 'Sup3r$ecretPass!')
    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'student@example.com', password: 'Sup3r$ecretPass!',
    }))
  })

  it('signs the session back out and shows a failure when no role resolves', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ ok: true, role: null, reason: 'awaiting_dean_approval' }),
    })
    render(<LoginPage />)
    await fillAndSubmit('student@example.com', 'Sup3r$ecretPass!')
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled())
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('dekanga yuborilgan'))
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('routes a superadmin (admin role) to /dekan/dekanlar, not the legacy dashboard', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ ok: true, role: 'admin' }),
    })
    render(<LoginPage />)
    await fillAndSubmit('admin@example.com', 'Sup3r$ecretPass!')
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dekan/dekanlar'), { timeout: 2000 })
  })

  it('routes an ordinary student to /talaba/dashboard', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => ({ ok: true, role: 'talaba' }),
    })
    render(<LoginPage />)
    await fillAndSubmit('student@example.com', 'Sup3r$ecretPass!')
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/talaba/dashboard'), { timeout: 2000 })
  })

  it('retries a transient 401 while a freshly-created session becomes visible', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null })
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false, status: 401, json: async () => ({ ok: false, error: 'Autentifikatsiya talab qilinadi' }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({ ok: true, role: 'tarbiyachi' }),
      })
    render(<LoginPage />)

    await fillAndSubmit('staff@example.com', 'Sup3r$ecretPass!')

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2), { timeout: 2000 })
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/tarbiyachi/dashboard'), { timeout: 2500 })
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('surfaces a network failure distinctly instead of a generic "no role" message', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: null })
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'))
    render(<LoginPage />)
    await fillAndSubmit('student@example.com', 'Sup3r$ecretPass!')
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Server bilan bog'lanib bo'lmadi. Internet aloqasini tekshiring."))
  })
})
