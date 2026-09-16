// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import toast from 'react-hot-toast'
import Step1Passport from './Step1Passport'
import { initialData } from './types'
import type { RegisterData } from './types'

vi.mock('react-hot-toast', () => ({ default: { custom: vi.fn() } }))

afterEach(() => {
  cleanup()
})

function setup(data: Partial<RegisterData>, requiresJshshir = true) {
  const onChange = vi.fn()
  const onNext = vi.fn()
  render(
    <Step1Passport
      data={{ ...initialData, ...data }}
      onChange={onChange}
      onNext={onNext}
      requiresJshshir={requiresJshshir}
    />,
  )
  return { onChange, onNext }
}

const validUzbek = {
  passportSeries: 'AB1234567',
  jshshir: '12345678901234',
  passportDate: '2020-01-01',
  passportPlace: 'Toshkent shahar IIB',
}

async function clickContinue() {
  await userEvent.setup().click(screen.getByRole('button', { name: /Davom etish/i }))
}

describe('Step1Passport', () => {
  it('rejects an empty form without calling onNext', async () => {
    const { onNext } = setup({})
    await clickContinue()
    expect(toast.custom).toHaveBeenCalled()
    await new Promise((r) => setTimeout(r, 50))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('rejects a malformed Uzbek passport series', async () => {
    const { onNext } = setup({ ...validUzbek, passportSeries: '1234' })
    await clickContinue()
    await new Promise((r) => setTimeout(r, 50))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('rejects a JSHSHIR shorter than 14 digits', async () => {
    const { onNext } = setup({ ...validUzbek, jshshir: '123' })
    await clickContinue()
    await new Promise((r) => setTimeout(r, 50))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('rejects a passport issue date in the future', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { onNext } = setup({ ...validUzbek, passportDate: future })
    await clickContinue()
    await new Promise((r) => setTimeout(r, 50))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('rejects an issue place shorter than 5 characters', async () => {
    const { onNext } = setup({ ...validUzbek, passportPlace: 'IIB' })
    await clickContinue()
    await new Promise((r) => setTimeout(r, 50))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('advances to the next step after a short delay once everything validates', async () => {
    const { onNext } = setup(validUzbek)
    await clickContinue()
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1), { timeout: 2000 })
  })

  it('does not require a JSHSHIR for the foreign-applicant (imtiyozli) variant', async () => {
    const { onNext } = setup({
      passportSeries: 'AB1234567',
      passportDate: '2020-01-01',
      passportPlace: 'Toshkent shahar IIB',
    }, false)
    await clickContinue()
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1), { timeout: 2000 })
  })

  it('normalizes typed passport series input through onChange', async () => {
    const { onChange } = setup({})
    await userEvent.setup().type(screen.getByPlaceholderText('AA1234567'), 'ab1234567')
    expect(onChange).toHaveBeenCalled()
    const lastCall = onChange.mock.calls.at(-1)?.[0]
    expect(lastCall.passportSeries).toBe(lastCall.passportSeries.toUpperCase())
  })

  it('shows an inline format error next to the passport field for an invalid, non-empty value', () => {
    setup({ passportSeries: '123' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
