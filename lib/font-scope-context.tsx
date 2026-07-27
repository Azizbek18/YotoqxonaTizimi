'use client'

import { createContext, useContext } from 'react'

/**
 * Portals (createPortal to document.body — CustomSelect's dropdown menu,
 * ConfirmModal, any page-local tooltip) render outside the DOM subtree of
 * whichever page mounted them, so CSS custom-property inheritance from a
 * page-scoped font wrapper (e.g. admin layout's `.baloo-scope`) can't reach
 * them — React context can, since it follows the React tree, not the DOM
 * tree. A section that wants its portaled content to pick up a specific
 * font provides a value here; consumers apply it as an inline
 * `style={{ fontFamily }}` on their own portal root. No provider = no
 * override, so pages that haven't opted into a custom font are unaffected.
 */
const FontScopeContext = createContext<string | undefined>(undefined)

export const FontScopeProvider = FontScopeContext.Provider

export function useScopedFontFamily() {
  return useContext(FontScopeContext)
}
