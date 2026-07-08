'use client'

import { useCallback, useState } from 'react'

/**
 * Shared state for the common "open a ConfirmModal for a specific target,
 * run an async action, show a loading spinner while it's in flight" pattern
 * used across the admin/sardor/talaba delete & reject confirmation dialogs.
 */
export function useConfirmModal<T = string>() {
  const [target, setTarget] = useState<T | undefined>(undefined)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const open = useCallback((value: T) => {
    setTarget(value)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  return { target, isOpen, isLoading, setIsLoading, open, close }
}
