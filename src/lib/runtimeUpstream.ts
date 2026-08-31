export const PIVOTA_STABLE_GATEWAY_URL = 'https://gateway.pivota.cc';

const isApprovedRuntimeHost = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === 'pivota.cc' ||
    normalized.endsWith('.pivota.cc') ||
    normalized === 'localhost' ||
    normalized === '127.0.0.1'
  );
};

/**
 * Keep old deployment environment variables from reintroducing retired direct
 * service hosts into a browser bundle. Public browser traffic has one stable
 * ingress; internal compute hostnames remain an implementation detail.
 */
export const normalizeRuntimeUpstream = (configured?: string | null) => {
  const candidate = String(configured || '').trim();
  if (!candidate) return PIVOTA_STABLE_GATEWAY_URL;

  try {
    const parsed = new URL(candidate);
    if (!isApprovedRuntimeHost(parsed.hostname)) return PIVOTA_STABLE_GATEWAY_URL;
  } catch {
    return PIVOTA_STABLE_GATEWAY_URL;
  }

  return candidate.replace(/\/+$/, '');
};
