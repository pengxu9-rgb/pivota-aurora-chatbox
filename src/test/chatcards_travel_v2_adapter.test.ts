import { describe, expect, it } from 'vitest';

import { adaptChatCardForRichRender } from '@/lib/chatCardsAdapters';

describe('chatCardsAdapters travel v2 compatibility', () => {
  it('adapts travel_structured sections when v2 cards use type instead of kind', () => {
    const hit = adaptChatCardForRichRender({
      cardType: 'travel',
      language: 'EN',
      payload: {
        sections: [
          {
            type: 'travel_structured',
            destination: 'Singapore',
            dates: '2026-03-13 to 2026-03-26',
            env_payload: {
              schema_version: 'aurora.ui.env_stress.v1',
              ess: 72,
              tier: 'High',
              radar: [],
              notes: [],
              travel_readiness: {
                destination_context: {
                  destination: 'Singapore',
                  start_date: '2026-03-13',
                  end_date: '2026-03-26',
                  env_source: 'climate_fallback',
                },
                delta_vs_home: {
                  summary_tags: ['baseline_unavailable', 'humid', 'high_uv'],
                },
                categorized_kit: [
                  {
                    id: 'sun_protection',
                    title: 'Sun protection',
                    preparations: [{ name: 'SPF 50+', detail: 'Reapply every 2 hours outdoors' }],
                  },
                ],
              },
            },
          },
        ],
      },
    });

    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('travel');
    expect(hit && 'data' in hit ? hit.data.payload.schema_version : null).toBe('aurora.ui.env_stress.v1');
    expect(hit && 'data' in hit ? hit.data.payload.travel_readiness.destination_context.destination : null).toBe('Singapore');
  });
});
