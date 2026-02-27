import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IngredientPlanCard } from '@/components/aurora/cards/IngredientPlanCard';

describe('ingredient plan products vs discovery UI', () => {
  it('renders purchasable products and discovery links in the same container with separate sections', () => {
    render(
      <IngredientPlanCard
        language="EN"
        cardId="plan_schema_ui_1"
        payload={{
          targets: [
            {
              ingredient: 'UV filters',
              products: {
                competitors: [
                  {
                    product_id: 'prod_1',
                    title: 'Daily UV Fluid SPF50',
                    pdp_url: 'https://example.com/pdp/daily-uv-fluid',
                  },
                ],
                dupes: [],
              },
            },
          ],
          external_search_ctas: [
            {
              title: 'Compare external UV options',
              url: 'https://example.com/discovery/uv-options',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Primary picks')).toBeInTheDocument();
    expect(screen.getByText('External search')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/pdp/daily-uv-fluid')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/discovery/uv-options')).toBeInTheDocument();
  });
});

