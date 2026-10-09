import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn() } },
}))

const { ClientCache, clearAllClientCaches } = await import('./client-cache')

function clock(start = 1_000) {
  let t = start
  return { now: () => t, tick: (ms: number) => { t += ms } }
}

describe('ClientCache', () => {
  it('serves a fresh entry without calling the loader again', async () => {
    const c = clock()
    const cache = new ClientCache<{ n: number }>(30_000, c.now)
    const loader = vi.fn(async () => ({ n: 1 }))
    await cache.get('k', loader)
    c.tick(10_000)
    expect(await cache.get('k', loader)).toEqual({ n: 1 })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('reloads once the TTL has passed', async () => {
    const c = clock()
    const cache = new ClientCache<number>(30_000, c.now)
    const loader = vi.fn(async () => 1)
    await cache.get('k', loader)
    c.tick(30_001)
    await cache.get('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('shares one in-flight request between concurrent callers', async () => {
    const cache = new ClientCache<number>(30_000)
    const loader = vi.fn(async () => { await Promise.resolve(); return 7 })
    const [a, b] = await Promise.all([cache.get('k', loader), cache.get('k', loader)])
    expect([a, b]).toEqual([7, 7])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('gives every caller its own copy, so mutating one never leaks', async () => {
    const cache = new ClientCache<{ items: string[] }>(30_000)
    const loader = async () => ({ items: ['a'] })
    const first = await cache.get('k', loader)
    first.items.push('mutated')
    const second = await cache.get('k', loader)
    expect(second.items).toEqual(['a'])
  })

  it('never caches a failure', async () => {
    const cache = new ClientCache<number>(30_000)
    const loader = vi.fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(5)
    await expect(cache.get('k', loader)).rejects.toThrow('boom')
    expect(await cache.get('k', loader)).toBe(5)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('clear() makes the next read fresh', async () => {
    const cache = new ClientCache<number>(30_000)
    const loader = vi.fn(async () => 1)
    await cache.get('k', loader)
    cache.clear()
    await cache.get('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('a clear() during a request stops that stale result from being cached', async () => {
    const cache = new ClientCache<number>(30_000)
    let resolve!: (n: number) => void
    const slow = vi.fn(() => new Promise<number>((r) => { resolve = r }))
    const pending = cache.get('k', slow)
    cache.clear()
    resolve(1)
    await pending
    const next = vi.fn(async () => 2)
    expect(await cache.get('k', next)).toBe(2)
  })

  it('invalidateAround clears before and after a write, success or failure', async () => {
    const cache = new ClientCache<number>(30_000)
    const loader = vi.fn(async () => 1)
    await cache.get('k', loader)
    await cache.invalidateAround(Promise.resolve('ok'))
    await cache.get('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)
    await expect(cache.invalidateAround(Promise.reject(new Error('nope')))).rejects.toThrow('nope')
    await cache.get('k', loader)
    expect(loader).toHaveBeenCalledTimes(3)
  })

  it('force reloads even when fresh', async () => {
    const cache = new ClientCache<number>(30_000)
    const loader = vi.fn(async () => 1)
    await cache.get('k', loader)
    await cache.get('k', loader, { force: true })
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('keeps different keys apart', async () => {
    const cache = new ClientCache<string>(30_000)
    expect(await cache.get('a', async () => 'A')).toBe('A')
    expect(await cache.get('b', async () => 'B')).toBe('B')
  })

  it('clearAllClientCaches empties every cache (sign-out / account switch)', async () => {
    const one = new ClientCache<number>(30_000)
    const two = new ClientCache<number>(30_000)
    const l1 = vi.fn(async () => 1)
    const l2 = vi.fn(async () => 2)
    await one.get('k', l1)
    await two.get('k', l2)
    clearAllClientCaches()
    await one.get('k', l1)
    await two.get('k', l2)
    expect(l1).toHaveBeenCalledTimes(2)
    expect(l2).toHaveBeenCalledTimes(2)
  })
})
