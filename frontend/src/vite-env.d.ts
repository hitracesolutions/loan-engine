/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base origin of the Cloudflare Worker API, e.g. https://api.gidfine.com */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
