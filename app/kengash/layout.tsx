import React from 'react'
import { PanelThemeProvider } from '@/components/leader/PanelThemeContext'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PanelThemeProvider storageKey="kengash-panel-theme">
      <div className="min-h-screen bg-[#070b13]">
        {children}
      </div>
    </PanelThemeProvider>
  )
}
