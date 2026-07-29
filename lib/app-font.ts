/**
 * A local system-font stack keeps production builds deterministic and avoids
 * making deployments depend on Google Fonts being reachable at build time.
 */
export const appFont = {
  className: '',
  style: {
    fontFamily: 'var(--app-font-sans)',
  },
} as const
