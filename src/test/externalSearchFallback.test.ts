import { describe, expect, it } from 'vitest';

import { buildGoogleSearchFallbackUrl, normalizeOutboundFallbackUrl } from '@/lib/externalSearchFallback';

describe('external search fallback', () => {
  it('builds google search URL with locale hint', () => {
    const cn = buildGoogleSearchFallbackUrl('IPSA Time Reset Aqua', 'CN');
    const en = buildGoogleSearchFallbackUrl('IPSA Time Reset Aqua', 'EN');
    expect(cn).toContain('google.com/search');
    expect(cn).toContain('q=IPSA+Time+Reset+Aqua');
    expect(cn).toContain('hl=zh-CN');
    expect(en).toContain('hl=en');
  });

  it('normalizes google redirect url to target URL', () => {
    const input = 'https://www.google.com/url?url=https%3A%2F%2Fexample.com%2Fp%2F123';
    expect(normalizeOutboundFallbackUrl(input)).toBe('https://example.com/p/123');
  });

  it('keeps direct https URL and rejects unsupported scheme', () => {
    expect(normalizeOutboundFallbackUrl('https://merchant.example/pdp?id=1')).toBe('https://merchant.example/pdp?id=1');
    expect(normalizeOutboundFallbackUrl('javascript:alert(1)')).toBeNull();
  });
});
