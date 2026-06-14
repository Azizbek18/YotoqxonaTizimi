'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { applyThemeToDocument, useThemeStore } from '@/lib/stores/theme-store'

export default function AppProviders({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme)
  const isLight = theme === 'light'
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
      <Toaster
        position="top-left"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(11, 17, 32, 0.7)',
            color: isLight ? '#0f172a' : '#ffffff',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: '600',
            letterSpacing: '-0.01em',
            boxShadow: isLight
              ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
              : '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: isLight ? '#ffffff' : '#0b1120',
            },
            style: {
              boxShadow: isLight
                ? '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 0 15px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                : '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              border: isLight ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(16, 185, 129, 0.3)',
            }
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: isLight ? '#ffffff' : '#0b1120',
            },
            style: {
              boxShadow: isLight
                ? '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 0 15px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                : '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(239, 68, 68, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              border: isLight ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(239, 68, 68, 0.3)',
            }
          },
          loading: {
            style: {
              boxShadow: isLight
                ? '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 0 15px rgba(168, 85, 247, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6)'
                : '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 0 15px rgba(168, 85, 247, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              border: isLight ? '1px solid rgba(168, 85, 247, 0.25)' : '1px solid rgba(168, 85, 247, 0.3)',
            }
          }
        }}
      />
    </QueryClientProvider>
  )
}
