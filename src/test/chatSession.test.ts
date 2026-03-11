import { describe, expect, it } from 'vitest';

import { buildChatSession, mergeSessionProfiles, resolveSessionProfile } from '@/lib/chatSession';

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

  it('adds analysis_context into session meta without dropping existing meta fields', () => {
    const session = buildChatSession({
      state: 'idle',
      profileSnapshot: { skinType: 'oily' },
      bootstrapProfile: null,
      sessionMeta: { source: 'chat' },
      analysisContext: {
        analysis_origin: 'photo',
        use_photo: true,
        photo_refs: [{ slot_id: 'daylight', photo_id: 'photo_1', qc_status: 'passed' }],
        source_card_type: 'analysis_story_v2',
      },
    });

    expect(session).toEqual({
      state: 'idle',
      profile: { skinType: 'oily' },
      meta: {
        source: 'chat',
        analysis_context: {
          analysis_origin: 'photo',
          use_photo: true,
          photo_refs: [{ slot_id: 'daylight', photo_id: 'photo_1', qc_status: 'passed' }],
          source_card_type: 'analysis_story_v2',
        },
      },
    });
  });

  it('merges nested travel_plan fields into existing session profile', () => {
    const merged = mergeSessionProfiles(
      { skinType: 'oily', travel_plan: { destination: 'Athens', start_date: '2026-03-12' } },
      {
        travel_plan: {
          destination_place: {
            label: 'Athens, Attica, Greece',
            canonical_name: 'Athens',
          },
          end_date: '2026-03-15',
        },
      },
    );

    expect(merged).toEqual({
      skinType: 'oily',
      travel_plan: {
        destination: 'Athens',
        start_date: '2026-03-12',
        end_date: '2026-03-15',
        destination_place: {
          label: 'Athens, Attica, Greece',
          canonical_name: 'Athens',
        },
      },
    });
  });

  it('builds session with merged profile patch when one-shot travel data is provided', () => {
    const session = buildChatSession({
      state: 'idle',
      profileSnapshot: { skinType: 'oily' },
      bootstrapProfile: null,
      sessionProfilePatch: {
        travel_plan: {
          destination: 'Athens',
          destination_place: {
            label: 'Athens, Attica, Greece',
            canonical_name: 'Athens',
          },
        },
      },
    });

    expect(session).toEqual({
      state: 'idle',
      profile: {
        skinType: 'oily',
        travel_plan: {
          destination: 'Athens',
          destination_place: {
            label: 'Athens, Attica, Greece',
            canonical_name: 'Athens',
          },
        },
      },
    });
  });
});
