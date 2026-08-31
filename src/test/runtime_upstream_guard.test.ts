import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  normalizeRuntimeUpstream,
  PIVOTA_STABLE_GATEWAY_URL,
} from '../lib/runtimeUpstream';

describe('runtime upstream guard', () => {
  it('maps missing and retired direct-compute hosts to the stable gateway', () => {
    const retiredPlatform = ['rail', 'way.app'].join('');
    const retiredCloudHost = ['service-abc.a.run', 'app'].join('.');

    expect(normalizeRuntimeUpstream()).toBe(PIVOTA_STABLE_GATEWAY_URL);
    expect(normalizeRuntimeUpstream(`https://old.${retiredPlatform}`)).toBe(
      PIVOTA_STABLE_GATEWAY_URL,
    );
    expect(normalizeRuntimeUpstream(`https://${retiredCloudHost}`)).toBe(
      PIVOTA_STABLE_GATEWAY_URL,
    );
  });

  it('preserves an approved stable origin and removes trailing slashes', () => {
    expect(normalizeRuntimeUpstream('https://gateway.pivota.cc///')).toBe(
      PIVOTA_STABLE_GATEWAY_URL,
    );
  });

  it('keeps retired runtime URLs out of deployment configuration and source', () => {
    const retiredPlatform = ['rail', 'way.app'].join('');
    const retiredCloudSuffix = ['run', 'app'].join('.');
    const files = [
      '.env.example',
      'vercel.json',
      'README.md',
      'src/lib/pivotaAgentBff.ts',
      'src/lib/pivotaApi.ts',
    ];

    for (const file of files) {
      const content = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(content, file).not.toContain(retiredPlatform);
      expect(content, file).not.toContain(retiredCloudSuffix);
    }
  });
});
