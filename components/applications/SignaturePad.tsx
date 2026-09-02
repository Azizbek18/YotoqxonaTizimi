'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

// A no-dependency signature canvas. Pointer events (finger / stylus / mouse),
// quadratic-midpoint smoothing, retina-aware backing store. Exports a
// trimmed PNG data URL. `onChange(null)` when cleared / empty.
export default function SignaturePad({
  onChange,
  isLight,
  height = 200,
}: {
  onChange: (dataUrl: string | null) => void
  isLight: boolean
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const dirty = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  const ctxOf = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [])

  const setup = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.min(window.devicePixelRatio || 1, 3)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2.4
    ctx.strokeStyle = isLight ? '#0f172a' : '#e2e8f0'
  }, [isLight])

  useEffect(() => {
    setup()
    const onResize = () => setup()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setup])

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pos(e)
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = ctxOf()
    const p = pos(e)
    if (!ctx || !last.current) { last.current = p; return }
    const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 }
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y)
    ctx.stroke()
    last.current = p
    if (!dirty.current) { dirty.current = true; setHasInk(true) }
  }

  const emit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !dirty.current) { onChange(null); return }
    onChange(trimCanvas(canvas))
  }, [onChange])

  const end = (e: React.PointerEvent) => {
    if (!drawing.current) return
    drawing.current = false
    canvasRef.current?.releasePointerCapture(e.pointerId)
    last.current = null
    emit()
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = ctxOf()
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    dirty.current = false
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed ${
          isLight ? 'border-slate-300 bg-white' : 'border-white/15 bg-white/[0.03]'
        }`}
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="h-full w-full touch-none"
          style={{ touchAction: 'none' }}
        />
        {!hasInk && (
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
            Shu yerga imzo qo‘ying
          </div>
        )}
        <div className={`pointer-events-none absolute bottom-2 left-4 right-4 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`} />
      </div>
      <button
        type="button"
        onClick={clear}
        disabled={!hasInk}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider disabled:opacity-40 ${
          isLight ? 'border-slate-300 text-slate-600 hover:bg-slate-100' : 'border-white/10 text-slate-300 hover:bg-white/5'
        }`}
      >
        <Eraser size={12} /> Tozalash
      </button>
    </div>
  )
}

// Crop transparent margins so the PNG is just the strokes, then return a
// data URL. Falls back to the full canvas if it somehow reads as empty.
function trimCanvas(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas.toDataURL('image/png')
  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)
  let top = height, left = width, right = 0, bottom = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < left || bottom < top) return canvas.toDataURL('image/png')
  const pad = 8
  left = Math.max(0, left - pad); top = Math.max(0, top - pad)
  right = Math.min(width, right + pad); bottom = Math.min(height, bottom + pad)
  const w = right - left, h = bottom - top
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(canvas, left, top, w, h, 0, 0, w, h)
  return out.toDataURL('image/png')
}
