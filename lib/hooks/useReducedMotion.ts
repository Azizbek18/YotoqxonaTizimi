'use client'

import { useReducedMotion as useFramerReducedMotion } from 'framer-motion'

// Thin wrapper around framer-motion's own hook so call sites have one
// import path, and so an in-app "reduce motion" toggle (if ever added,
// stored the same way as lib/stores/theme-store.ts) only needs to change
// this one function instead of every call site.
export function useReducedMotion(): boolean {
  return useFramerReducedMotion() ?? false
}
