// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Step9Password from './Step9Password'
import { initialData } from './types'

afterEach(() => {
  cleanup()
})

function setup(overrides: Partial<React.ComponentProps<typeof Step9Password>> = {}) {
  const onPasswordChange = vi.fn()
  const onConfirmPasswordChange = vi.fn()
  const onSubmit = vi.fn()
  const onBack = vi.fn()
  render(
    <Step9Password
      data={{ ...initialData, email: 'student@example.com' }}
      password=""
      confirmPassword=""
      onPasswordChange={onPasswordChange}
      onConfirmPasswordChange={onConfirmPasswordChange}
      onSubmit={onSubmit}
      onBack={onBack}
      loading={false}
      {...overrides}
    />,
  )
  return { onPasswordChange, onConfirmPasswordChange, onSubmit, onBack }
}

describe('Step9Password', () => {
  it('disables submit while the password fields are empty', () => {
    setup()
    expect(screen.getByRole('button', { name: /Ro'yxatdan o'tish/i })).toBeDisabled()
  })

  it('reports each keystroke through onPasswordChange without managing its own value', async () => {
    const { onPasswordChange } = setup()
    await userEvent.setup().type(screen.getByPlaceholderText('Kuchli parol'), 'a')
    expect(onPasswordChange).toHaveBeenCalledWith('a')
  })

  it('shows a mismatch message when the confirmation differs, and keeps submit disabled', () => {
    setup({ password: 'Sup3r$ecretPass!', confirmPassword: 'different' })
    expect(screen.getByText('Parollar bir-biriga mos kelmadi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ro'yxatdan o'tish/i })).toBeDisabled()
  })

  it('keeps submit disabled when the password fails the policy even if both fields match', () => {
    setup({ password: 'short', confirmPassword: 'short' })
    expect(screen.queryByText('Parollar bir-biriga mos kelmadi')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ro'yxatdan o'tish/i })).toBeDisabled()
  })

  it('enables submit once the password satisfies the policy and both fields match', () => {
    setup({ password: 'Sup3r$ecretPass!', confirmPassword: 'Sup3r$ecretPass!' })
    expect(screen.getByRole('button', { name: /Ro'yxatdan o'tish/i })).toBeEnabled()
  })

  it('calls onSubmit when the enabled submit button is clicked', async () => {
    const { onSubmit } = setup({ password: 'Sup3r$ecretPass!', confirmPassword: 'Sup3r$ecretPass!' })
    await userEvent.setup().click(screen.getByRole('button', { name: /Ro'yxatdan o'tish/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('disables both submit and back while loading (submit shows a spinner, not its label)', () => {
    setup({ password: 'Sup3r$ecretPass!', confirmPassword: 'Sup3r$ecretPass!', loading: true })
    expect(screen.queryByText(/Ro'yxatdan o'tish/i)).not.toBeInTheDocument()
    // DOM order: password show/hide toggle, then "Orqaga", then submit (last).
    const buttons = screen.getAllByRole('button')
    expect(screen.getByRole('button', { name: 'Orqaga' })).toBeDisabled()
    expect(buttons.at(-1)).toBeDisabled()
  })

  it('calls onBack when the back button is clicked', async () => {
    const { onBack } = setup()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Orqaga' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
