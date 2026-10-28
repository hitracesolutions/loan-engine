/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base origin of the Cloudflare Worker API, e.g. https://api.gidfine.com */
  readonly VITE_API_BASE?: string;
  /** Legacy alias kept for existing Cloudflare Pages deployments. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
