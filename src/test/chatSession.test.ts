import { describe, expect, it } from 'vitest';

import { buildChatSession, resolveSessionProfile } from '@/lib/chatSession';

describe('chatSession', () => {
  it('prefers profileSnapshot over bootstrapProfile', () => {
    const snapshot = { skinType: 'oily' };
    const bootstrap = { skinType: 'dry' };
    const resolved = resolveSessionProfile({ profileSnapshot: snapshot, bootstrapProfile: bootstrap });
    expect(resolved).toBe(snapshot);
  });

  it('falls back to bootstrapProfile when snapshot missing', () => {
    const bootstrap = { skinType: 'dry' };
    const resolved = resolveSessionProfile({ profileSnapshot: null, bootstrapProfile: bootstrap });
    expect(resolved).toBe(bootstrap);
  });

  it('builds session with profile when available', () => {
    const snapshot = { skinType: 'oily' };
    const session = buildChatSession({ state: 'idle', profileSnapshot: snapshot, bootstrapProfile: null });
    expect(session).toEqual({ state: 'idle', profile: snapshot });
  });

  it('builds session without profile when missing', () => {
    const session = buildChatSession({ state: 'idle', profileSnapshot: null, bootstrapProfile: null });
    expect(session).toEqual({ state: 'idle' });
  });
});

