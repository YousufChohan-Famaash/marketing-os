/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** REST base for the widget backend, e.g. https://api.catafleet.com/api/v1/widget */
  readonly VITE_WIDGET_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
