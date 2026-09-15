import React from 'react'
import ForceDarkTheme from '@/components/leader/ForceDarkTheme'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#070b13]">
      <ForceDarkTheme />
      {children}
    </div>
  )
}
