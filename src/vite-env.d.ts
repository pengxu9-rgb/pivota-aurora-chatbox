/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_UPLOAD_ENDPOINT?: string;
  readonly VITE_SHOP_GATEWAY_URL?: string;
  readonly VITE_PIVOTA_AGENT_URL?: string;
  readonly VITE_PIVOTA_SHOP_URL?: string;
}
