import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IngredientPlanCard } from '@/components/aurora/cards/IngredientPlanCard';
import { analytics } from '@/lib/analytics';

const analyticsCtx = {
  brief_id: 'brief_discovery',
  trace_id: 'trace_discovery',
  aurora_uid: 'uid_discovery',
  lang: 'en' as const,
  state: 'IDLE_CHAT',
};

describe('ingredient plan discovery card tracking', () => {
  beforeEach(() => {
    vi.spyOn(analytics, 'emit').mockImplementation(() => {});
    vi.spyOn(window, 'open').mockImplementation(() => ({ closed: false } as Window));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits discovery open attempt/result for external_search_ctas links', () => {
    render(
      <IngredientPlanCard
        language="EN"
        analyticsCtx={analyticsCtx}
        cardId="plan_card_discovery"
        payload={{
          targets: [],
          external_search_ctas: [
            {
              title: 'Search UV filters',
              url: 'https://example.com/search?q=uv+filters',
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByText('https://example.com/search?q=uv+filters'));

    expect(analytics.emit).toHaveBeenCalledWith(
      'discovery_link_open_attempt',
      'brief_discovery',
      'trace_discovery',
      expect.objectContaining({
        card_id: 'plan_card_discovery',
        source_card_type: 'ingredient_plan_v2',
      }),
    );
    expect(analytics.emit).toHaveBeenCalledWith(
      'discovery_link_open_result',
      'brief_discovery',
      'trace_discovery',
      expect.objectContaining({
        result: 'success_new_tab',
      }),
    );
  });
});

