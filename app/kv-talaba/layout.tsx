import React from 'react'

// KV-talaba (off-campus student) shell — deliberately its own visual
// identity, not a reskin of /talaba/*: this account is structurally nothing
// like a dorm resident (no room, no floor, no sardor). A distinct dark
// teal/emerald ground (vs. /talaba's painted-button indigo world and
// /kengash's #070b13) keeps that difference visible at a glance.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#04120f]">{children}</div>
  )
}
