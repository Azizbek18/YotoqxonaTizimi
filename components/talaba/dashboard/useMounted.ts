'use client';

import { useEffect, useState } from 'react';

/**
 * True once the component has mounted on the client. Portalled modals use
 * this to avoid rendering into `document.body` during SSR / first hydration.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
