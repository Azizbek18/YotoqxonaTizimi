'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

// A no-dependency signature canvas tuned for cheap Android phones, where the
// naive version dropped strokes ("imzo uzilib qolyapti"):
//   - pointer capture, and NO `pointerleave` ending the stroke — that event
//     fires on the tiniest finger wobble past the edge and was the #1 cause
//     of broken lines. Moves keep arriving via capture.
//   - getCoalescedEvents(): 90/120 Hz screens batch pointermove, so a fast
//     stroke arrives as a few far-apart points — expand them or the line gaps.
//   - the drawing survives a viewport resize. A window 'resize' listener +
//     canvas.width reset used to WIPE a half-drawn signature every time the
//     mobile address bar showed/hid. Now a ResizeObserver on the element
//     (which doesn't move when the address bar does) repaints instead.
//   - midpoint smoothing through the actual sample points.
// API unchanged: onChange(dataUrl | null), isLight, height.
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
  const pts = useRef<{ x: number; y: number }[]>([])
  const dirty = useRef(false)
  const [hasInk, setHasInk] = useState(false)
  const ink = isLight ? '#0f172a' : '#e2e8f0'
  const inkRef = useRef(ink)
  // The parent's callback, kept current so the window-level pointerup safety
  // net (bound once) always calls the latest one.
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  const applyCtxStyle = useCallback((ctx: CanvasRenderingContext2D, ratio: number) => {
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 2.6
    ctx.strokeStyle = inkRef.current
  }, [])

  // Resize the backing store to the element size, keeping whatever is drawn.
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.min(window.devicePixelRatio || 1, 3)
    const rect = canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width * ratio))
    const h = Math.max(1, Math.round(rect.height * ratio))
    if (canvas.width === w && canvas.height === h) return

    let snapshot: HTMLCanvasElement | null = null
    if (canvas.width > 0 && canvas.height > 0) {
      snapshot = document.createElement('canvas')
      snapshot.width = canvas.width
      snapshot.height = canvas.height
      snapshot.getContext('2d')?.drawImage(canvas, 0, 0)
    }
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (snapshot) ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, w, h)
    applyCtxStyle(ctx, ratio)
  }, [applyCtxStyle])

  useEffect(() => {
    fitCanvas()
    const el = canvasRef.current
    if (!el || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fitCanvas)
      return () => window.removeEventListener('resize', fitCanvas)
    }
    const ro = new ResizeObserver(() => fitCanvas())
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitCanvas])

  // Theme change: recolour future strokes without touching the drawing.
  useEffect(() => {
    inkRef.current = ink
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.strokeStyle = ink
  }, [ink])

  const pointFrom = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const strokeThrough = () => {
    const ctx = canvasRef.current?.getContext('2d')
    const p = pts.current
    if (!ctx || p.length < 2) return
    if (p.length === 2) {
      ctx.beginPath()
      ctx.moveTo(p[0].x, p[0].y)
      ctx.lineTo(p[1].x, p[1].y)
      ctx.stroke()
      return
    }
    const a = p[p.length - 3]
    const b = p[p.length - 2]
    const c = p[p.length - 1]
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }
    ctx.beginPath()
    ctx.moveTo(m1.x, m1.y)
    ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y)
    ctx.stroke()
  }

  const markInk = () => {
    if (dirty.current) return
    dirty.current = true
    setHasInk(true)
  }

  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    try { canvasRef.current?.setPointerCapture(e.pointerId) } catch { /* older webview */ }
    drawing.current = true
    pts.current = [pointFrom(e)]
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    e.preventDefault()
    const native = e.nativeEvent
    const batch =
      typeof native.getCoalescedEvents === 'function' && native.getCoalescedEvents().length
        ? native.getCoalescedEvents()
        : [native]
    for (const ev of batch) {
      pts.current.push(pointFrom(ev))
      strokeThrough()
    }
    if (pts.current.length > 1) markInk()
  }

  const emit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !dirty.current) { onChangeRef.current(null); return }
    onChangeRef.current(trimCanvas(canvas))
  }, [])

  const finish = useCallback((e?: React.PointerEvent) => {
    if (!drawing.current) return
    drawing.current = false
    if (e) { try { canvasRef.current?.releasePointerCapture(e.pointerId) } catch { /* ignore */ } }
    // A single tap (no move) still counts — drop a dot.
    if (pts.current.length === 1) {
      const ctx = canvasRef.current?.getContext('2d')
      const p = pts.current[0]
      if (ctx) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fillStyle = inkRef.current
        ctx.fill()
        markInk()
      }
    }
    pts.current = []
    emit()
  }, [emit])

  // Safety net: if pointer capture silently failed on an old webview, a
  // pointerup outside the canvas would never reach onPointerUp.
  useEffect(() => {
    const up = () => finish()
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [finish])

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    dirty.current = false
    pts.current = []
    setHasInk(false)
    onChange(null)
  }

  return (
    <div className="space-y-2 select-none">
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
          onPointerUp={finish}
          onPointerCancel={finish}
          onContextMenu={(e) => e.preventDefault()}
          className="h-full w-full touch-none"
          style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
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
  let imgData: ImageData
  try {
    imgData = ctx.getImageData(0, 0, width, height)
  } catch {
    return canvas.toDataURL('image/png')
  }
  const data = imgData.data
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
  const pad = 10
  left = Math.max(0, left - pad); top = Math.max(0, top - pad)
  right = Math.min(width, right + pad); bottom = Math.min(height, bottom + pad)
  const w = right - left, h = bottom - top
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(canvas, left, top, w, h, 0, 0, w, h)
  return out.toDataURL('image/png')
}
