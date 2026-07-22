'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, resolveValue } from 'react-hot-toast'
import { applyThemeToDocument, useThemeStore } from '@/lib/stores/theme-store'
import Custom3DToast from '@/components/ui/Custom3DToast'
import { isNativeApp } from '@/lib/platform'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  )

  useEffect(() => {
    // Register PWA service worker (skip inside the native Capacitor app —
    // the shell already packages the app, so a competing service worker
    // cache only adds overhead with no benefit there)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isNativeApp()) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('ServiceWorker registered:', reg.scope))
          .catch((err) => console.error('ServiceWorker registration failed:', err))
      } else {
        // A service worker registered from an earlier production build stays
        // active for this origin and intercepts dev-server requests, causing
        // spurious "Failed to fetch" errors as Turbopack's assets churn.
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister())
        })
      }
    }

    if (useThemeStore.persist.hasHydrated()) {
      applyThemeToDocument(useThemeStore.getState().theme)
      return
    }

    const unsubscribe = useThemeStore.persist.onFinishHydration((state) => {
      applyThemeToDocument(state.theme)
    })

    useThemeStore.persist.rehydrate()

    return unsubscribe
  }, [])

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  return (
    <QueryClientProvider client={queryClient}>
      <div id="app-shell" className="min-h-screen transition-[background,color,box-shadow,border-color] duration-500 ease-out">
        {children}
      </div>
      <Toaster
        position="top-center"
        reverseOrder={false}
        containerStyle={{ zIndex: 99999999, top: 'var(--toast-offset-top, 16px)' }}
      >
        {(t) => {
          if (t.type === 'custom') {
            return (
              <div key={t.id} style={{ opacity: t.visible ? 1 : 0, transition: 'opacity 0.2s ease' }}>
                {resolveValue(t.message, t)}
              </div>
            )
          }

          return <Custom3DToast toast={t} />
        }}
      </Toaster>
    </QueryClientProvider>
  )
}
