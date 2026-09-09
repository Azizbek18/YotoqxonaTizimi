import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const effects = vi.hoisted(() => [] as Array<() => void | (() => void)>)
const auth = vi.hoisted(() => ({
  userId: 'user-1' as string | null,
  listeners: new Set<(event: string, session: { user: { id: string } } | null) => void>(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  onAuthStateChange: (listener: (event: string, session: { user: { id: string } } | null) => void) => {
    auth.listeners.add(listener)
    listener('INITIAL_SESSION', auth.userId ? { user: { id: auth.userId } } : null)
    return { data: { subscription: { unsubscribe: () => auth.listeners.delete(listener) } } }
  },
} } }))
vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
}))
import { useVisiblePoll } from './useVisiblePoll'

let doc: EventTarget & { hidden: boolean }
let win: EventTarget
let network: { onLine: boolean }
let cleanups: Array<() => void>
function mount(fn: (silent: boolean) => void | Promise<void>, enabled = true) {
  // React effects are mocked above to exercise subscription cleanup with fake timers.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useVisiblePoll(fn, 1000, { enabled })
  for (const effect of effects.splice(0)) {
    const cleanup = effect()
    if (cleanup) cleanups.push(cleanup)
  }
  vi.advanceTimersByTime(0)
}
beforeEach(() => {
  vi.useFakeTimers()
  cleanups = []
  auth.userId = 'user-1'
  auth.listeners.clear()
  doc = Object.assign(new EventTarget(), { hidden: false })
  win = new EventTarget()
  network = { onLine: true }
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', win)
  vi.stubGlobal('navigator', network)
})
afterEach(() => {
  cleanups.forEach((cleanup) => cleanup())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('visible polling request lifecycle', () => {
  it('stops on logout and resumes on login without remounting', async () => {
    const fn = vi.fn()
    mount(fn)
    expect(fn).toHaveBeenCalledTimes(1)
    auth.listeners.forEach((listener) => listener('SIGNED_OUT', null))
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
    doc.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
    auth.listeners.forEach((listener) => listener('SIGNED_IN', { user: { id: 'user-1' } }))
    await vi.advanceTimersByTimeAsync(0)
    expect(fn).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(3)
  })
  it('never starts a poll without a session', async () => {
    auth.userId = null
    const fn = vi.fn()
    mount(fn)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).not.toHaveBeenCalled()
  })
  it('does not fetch in a hidden tab and refreshes when it becomes visible', async () => {
    doc.hidden = true
    const fn = vi.fn()
    mount(fn)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).not.toHaveBeenCalled()
    doc.hidden = false
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(fn).toHaveBeenCalledWith(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenLastCalledWith(true)
    doc.hidden = true
    doc.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('does not overlap slow requests, including focus events', async () => {
    let resolve!: () => void
    const fn = vi.fn(() => new Promise<void>((done) => { resolve = done }))
    mount(fn)
    doc.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
    resolve()
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('pauses offline and retries rejected requests after reconnecting', async () => {
    network.onLine = false
    const fn = vi.fn().mockRejectedValue(new Error('network'))
    mount(fn)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fn).not.toHaveBeenCalled()
    network.onLine = true
    win.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('does not reschedule after unmounting during a request', async () => {
    let resolve!: () => void
    const fn = vi.fn(() => new Promise<void>((done) => { resolve = done }))
    mount(fn)
    cleanups.forEach((cleanup) => cleanup())
    resolve()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not fetch when disabled', async () => {
    const fn = vi.fn()
    mount(fn, false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).not.toHaveBeenCalled()
  })
})
