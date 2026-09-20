import React from 'react'
import { PanelThemeProvider } from '@/components/leader/PanelThemeContext'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <PanelThemeProvider storageKey="sardor-panel-theme">
      <div className="min-h-screen min-w-0 overflow-x-clip bg-[#070b13]">
        {children}
      </div>
    </PanelThemeProvider>
  )
}
