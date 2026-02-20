import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoutineCompatibilityFooter } from '@/components/chat/cards/RoutineCompatibilityFooter';

describe('RoutineCompatibilityFooter', () => {
  it('renders collapsed footer and opens compatibility sheet', async () => {
    render(
      <RoutineCompatibilityFooter
        language="EN"
        baseProduct={{
          id: 'base_1',
          name: 'Copper Peptide Serum',
          brand: 'The Ordinary',
          ingredientTokens: ['Copper Tripeptide-1', 'Sodium Hyaluronate'],
          source: 'base',
        }}
        routineProducts={[
          {
            id: 'routine_1',
            name: 'Hydrating Moisturizer',
            ingredientTokens: ['Ceramide', 'Glycerin'],
            source: 'routine',
          },
        ]}
      />,
    );

    expect(screen.getByText('Compatibility with your routine')).toBeInTheDocument();
    expect(screen.getByText('Check with my products')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Check with my products' }));
    expect(await screen.findByRole('dialog', { name: 'Check compatibility' })).toBeInTheDocument();
  });
});
