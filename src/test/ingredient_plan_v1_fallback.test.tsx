import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IngredientPlanCardV1 } from '@/components/chat/cards/IngredientPlanCardV1';

describe('ingredient_plan fallback card', () => {
  it('humanizes legacy ingredient tokens and hides raw priority markers', () => {
    render(
      <IngredientPlanCardV1
        language="EN"
        payload={{
          intensity: 'gentle',
          confidence: { level: 'medium', score: 0.74 },
          targets: [
            {
              ingredient_id: 'ceramide_np',
              role: 'hero',
              priority: 90,
              usage_guidance: ['AM/PM barrier support'],
              confidence: { rationale: ['R_BARRIER_001'] },
            },
            {
              ingredient_id: 'panthenol',
              priority: 86,
              usage_guidance: ['Use on damp skin'],
            },
          ],
          avoid: [
            { ingredient_id: 'salicylic_acid', severity: 'avoid', reason: ['Irritation stacking risk'] },
          ],
          conflicts: [{ description: 'Avoid layering strong exfoliants together.' }],
        }}
      />,
    );

    expect(screen.getByText('Ceramide NP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    fireEvent.click(screen.getByRole('button', { name: /support ingredients/i }));
    expect(screen.getByText('Panthenol (B5)')).toBeInTheDocument();
    expect(screen.getByText('Salicylic acid (BHA)')).toBeInTheDocument();

    expect(screen.queryByText('ceramide_np')).not.toBeInTheDocument();
    expect(screen.queryByText('salicylic_acid')).not.toBeInTheDocument();
    expect(screen.queryByText(/P\d+/)).not.toBeInTheDocument();
    expect(screen.queryByText('Intensity: gentle')).not.toBeInTheDocument();
  });
});
