// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { roomIdentity } from '@/lib/room-identity'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/lib/auth-session', () => ({ getSafeUser: async () => ({ id: 'chair' }), getAuthHeaders: async () => ({}) }))
vi.mock('@/features/profile/client/api', () => ({ fetchStudentProfile: async () => ({ profile: {
  id: 'chair', full_name: 'Rais', email: 'chair@example.test', gender: 'male', is_council_chair: true,
} }) }))
vi.mock('@/lib/hooks/useMyCouncilPermissions', () => ({ useMyCouncilPermissions: () => ({ allows: () => true, permissions: null }) }))
vi.mock('@/components/leader/PanelThemeContext', () => ({ usePanelTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }))
vi.mock('@/components/leader/LeaderBackdrop', () => ({ default: () => null }))
vi.mock('@/components/leader/LeaderHeader', () => ({ default: () => null }))
vi.mock('@/components/kengash/StoryManager', () => ({ default: () => null }))
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }))
vi.mock('@/components/leader/ModalShell', () => ({ default: ({ title, description, children, onClose }: {
  title: string; description: string; children: React.ReactNode; onClose: () => void
}) => <section role="dialog"><h2>{title}</h2><p>{description}</p><button onClick={onClose}>Yopish</button>{children}</section> }))
vi.mock('@/components/ui/CustomSelect', () => ({ default: ({ value, onChange, options }: {
  value: string; onChange: (value: string) => void; options: { value: string; label: string }[]
}) => <select aria-label={options.some((o) => o.label.includes('yotoqxona')) ? 'Yotoqxona' : 'Blok'} value={value}
  onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> }))
vi.mock('framer-motion', async () => {
  const react = await import('react')
  const components = Object.fromEntries(['div', 'span', 'button'].map((tag) => [tag, react.forwardRef((props: Record<string, unknown>, ref) => {
    const animationProps = new Set(['children', 'initial', 'animate', 'exit', 'variants', 'transition', 'layoutId', 'whileHover', 'whileTap'])
    const domProps = Object.fromEntries(Object.entries(props).filter(([name]) => !animationProps.has(name)))
    return react.createElement(tag, { ...domProps, ref }, props.children as React.ReactNode)
  })]))
  return { motion: components, AnimatePresence: ({ children }: { children: React.ReactNode }) => children }
})
const { default: Dashboard } = await import('./page')

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('council room selection', () => {
  it('shows only the selected dorm, block and floor residents when room 8 repeats', async () => {
    const addresses = [
      { dorm_id: 'girls', dormNumber: '3', block: null, floor_number: 1, capacity: 4 },
      { dorm_id: 'boys', dormNumber: '4', block: null, floor_number: 2, capacity: 4 },
      { dorm_id: 'blocked', dormNumber: '7', block: 'A', floor_number: 11, capacity: 5 },
      { dorm_id: 'blocked', dormNumber: '7', block: 'A', floor_number: 12, capacity: 10 },
      { dorm_id: 'blocked', dormNumber: '7', block: 'B', floor_number: 11, capacity: 2 },
    ]
    const rooms = addresses.map((address) => ({ ...address, room_number: '8', roomNumber: '8', floor: address.floor_number,
      frozen: false, key: roomIdentity({ ...address, room_number: '8' }) }))
    const names = ['Qiz talaba', 'Yigit talaba', 'A11 talaba', 'A12 talaba', 'B11 talaba']
    const students = addresses.map((address, index) => ({ ...address, id: `s${index}`, assigned_floor: address.floor_number,
      full_name: names[index], room_number: '8', email: `s${index}@example.test`, phone_number: null, faculty: 'amit',
      course: 2, group: null, direction: null, avatar_url: null, gender: index === 0 ? 'female' : 'male',
      is_floor_captain: false, arizaCount: 0, tushuntirishCount: 0 }))
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/rooms') ? { rooms }
      : url.includes('/students?') ? { students: [] } : url.endsWith('/students') ? { students } : { elonlar: [] } })))
    render(<Dashboard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Xonalar Xaritasi' }))
    const openRoom = async (expected: string) => {
      fireEvent.click(await screen.findByRole('button', { name: /8 xona/ }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).queryByText(expected)).not.toBeNull()
      for (const name of names.filter((name) => name !== expected)) expect(within(dialog).queryByText(name)).toBeNull()
      fireEvent.click(within(dialog).getByText('Yopish'))
    }
    await openRoom('Qiz talaba')
    fireEvent.change(screen.getByRole('combobox', { name: 'Yotoqxona' }), { target: { value: 'boys' } })
    await openRoom('Yigit talaba')
    fireEvent.change(screen.getByRole('combobox', { name: 'Yotoqxona' }), { target: { value: 'blocked' } })
    await waitFor(() => expect((screen.getByRole('combobox', { name: 'Blok' }) as HTMLSelectElement).value).toBe('A'))
    await openRoom('A11 talaba')
    fireEvent.click(screen.getByRole('button', { name: /12-qavat/ }))
    await openRoom('A12 talaba')
    fireEvent.change(screen.getByRole('combobox', { name: 'Blok' }), { target: { value: 'B' } })
    await openRoom('B11 talaba')
  })
})
