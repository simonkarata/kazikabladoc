/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the AI server (default '' = same origin, proxied in dev). */
  readonly VITE_API_BASE?: string
  /** Set to 'mock' to force the offline mock provider. */
  readonly VITE_AI_PROVIDER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
