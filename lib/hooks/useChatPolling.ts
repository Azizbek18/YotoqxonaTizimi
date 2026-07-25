import { useEffect, useRef } from 'react'

// Polls `fn` every `intervalMs` while `active` is true: once immediately
// (non-silent), then silently on each tick. Restarts whenever `active` or
// `restartKey` changes (e.g. switching which student's chat is open).
export function usePollingEffect(
  fn: (silent: boolean) => void | Promise<void>,
  active: boolean,
  restartKey: unknown,
  intervalMs = 4000,
) {
  useEffect(() => {
    if (!active) return
    void fn(false)
    const interval = setInterval(() => void fn(true), intervalMs)
    return () => clearInterval(interval)
    // fn is an inline closure recreated every render; only active/restartKey
    // should trigger a restart, not each new function identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, restartKey, intervalMs])
}

// Scrolls a chat's `endRef` into view when `messageCount` grows, but only
// if the viewer was already near the bottom (or this is the first load
// since `active` became true).
export function useChatAutoScroll(messageCount: number, active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    if (!active) {
      prevCountRef.current = 0
      return
    }

    const prevCount = prevCountRef.current
    prevCountRef.current = messageCount
    if (messageCount === prevCount) return

    const container = containerRef.current
    const nearBottom = !container || container.scrollHeight - container.scrollTop - container.clientHeight < 120
    if (prevCount === 0 || nearBottom) {
      endRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messageCount, active])

  return { containerRef, endRef }
}
