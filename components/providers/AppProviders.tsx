'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import ThemeToggle from '@/components/theme/ThemeToggle'
import { applyThemeToDocument, useThemeStore } from '@/lib/stores/theme-store'

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
      <ThemeToggle />
      <Toaster position="top-left" reverseOrder={false} />
    </QueryClientProvider>
  )
}
