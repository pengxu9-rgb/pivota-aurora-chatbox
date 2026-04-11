import { describe, expect, it } from 'vitest';

import { parseChatResponseV1 } from '@/lib/chatCardsParser';
import type { ChatResponseV1 } from '@/lib/chatCardsTypes';

describe('chat cards recommendations contract', () => {
  it('accepts recommendations as a typed ChatCardV1 card', () => {
    const response: ChatResponseV1 = {
      version: '1.0',
      request_id: 'req_recommendations_typed',
      trace_id: 'trace_recommendations_typed',
      cards: [
        {
          id: 'card_recommendations',
          type: 'recommendations',
          priority: 1,
          title: 'Product Recommendations',
          tags: [],
          sections: [
            {
              kind: 'product_cards',
              products: [
                {
                  product_id: 'prod_1',
                  name: 'Oil Balance Serum',
                  brand: 'Clear Lab',
                  price_label: '$12',
                },
              ],
            },
          ],
          actions: [],
        },
      ],
      follow_up_questions: [],
      suggested_quick_replies: [],
      ops: {
        thread_ops: [],
        profile_patch: [],
        routine_patch: [],
        experiment_events: [],
      },
      safety: {
        risk_level: 'none',
        red_flags: [],
        disclaimer: '',
      },
      telemetry: {
        intent: 'reco_products',
        intent_confidence: 0.92,
        entities: [],
      },
    };

    const parsed = parseChatResponseV1(response);
    expect(parsed?.cards[0]?.type).toBe('recommendations');
    expect(parsed?.cards[0]?.sections?.[0]).toMatchObject({
      kind: 'product_cards',
    });
  });
});
