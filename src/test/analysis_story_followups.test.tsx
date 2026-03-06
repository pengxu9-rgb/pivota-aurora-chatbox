import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisStoryCard } from '@/components/aurora/cards/AnalysisStoryCard';

describe('analysis_story_v2 follow-ups', () => {
  it('keeps only analysis-oriented follow-up buttons', () => {
    const onAction = vi.fn();
    render(
      <AnalysisStoryCard
        language="EN"
        payload={{}}
        onAction={onAction}
      />,
    );

    expect(screen.getByRole('button', { name: 'Dive deeper into skin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingredient plan details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See product recommendations' })).not.toBeInTheDocument();
    expect(screen.queryByText(/No shortlist yet/i)).not.toBeInTheDocument();
  });

  it('fires the correct chip IDs for analysis follow-ups', () => {
    const onAction = vi.fn();
    render(
      <AnalysisStoryCard
        language="EN"
        payload={{}}
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dive deeper into skin' }));
    expect(onAction).toHaveBeenCalledWith(
      'chip.aurora.next_action.deep_dive_skin',
      expect.objectContaining({ trigger_source: 'analysis_story_v2' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ingredient plan details' }));
    expect(onAction).toHaveBeenCalledWith(
      'chip.aurora.next_action.ingredient_plan',
      expect.objectContaining({ trigger_source: 'analysis_story_v2' }),
    );
  });
});
