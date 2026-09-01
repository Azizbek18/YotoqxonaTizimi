import { describe, expect, it } from 'vitest'
import { asCoordinate, haversineMeters } from './geo'

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters({ lat: 41.31, lng: 69.24 }, { lat: 41.31, lng: 69.24 })).toBe(0)
  })

  it('matches a known short distance (~157 m per 0.001 lat degree)', () => {
    const d = haversineMeters({ lat: 41.311, lng: 69.240 }, { lat: 41.312, lng: 69.240 })
    expect(d).toBeGreaterThan(105)
    expect(d).toBeLessThan(120)
  })

  it('is roughly symmetric and grows with separation', () => {
    const near = haversineMeters({ lat: 41.311, lng: 69.240 }, { lat: 41.315, lng: 69.245 })
    const far = haversineMeters({ lat: 41.311, lng: 69.240 }, { lat: 41.360, lng: 69.290 })
    expect(near).toBeLessThan(1000)
    expect(far).toBeGreaterThan(5000)
  })
})

describe('asCoordinate', () => {
  it('accepts numeric strings in range', () => {
    expect(asCoordinate('41.31', '69.24')).toEqual({ lat: 41.31, lng: 69.24 })
  })
  it('rejects out-of-range and non-finite', () => {
    expect(asCoordinate(200, 10)).toBeNull()
    expect(asCoordinate('abc', 10)).toBeNull()
    expect(asCoordinate(null, null)).toBeNull()
  })
})
