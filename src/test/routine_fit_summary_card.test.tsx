import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RoutineFitSummaryCard } from '@/components/aurora/cards/RoutineFitSummaryCard';

describe('RoutineFitSummaryCard', () => {
  it('renders score bars correctly for 0, 0.5, and 1', () => {
    const { container } = render(
      <RoutineFitSummaryCard
        language="EN"
        payload={{
          overall_fit: 'partial_match',
          fit_score: 0.5,
          summary: 'Balanced overall fit.',
          dimension_scores: {
            ingredient_match: { score: 0, note: 'Low' },
            routine_completeness: { score: 0.5, note: 'Medium' },
            conflict_risk: { score: 1, note: 'High' },
            sensitivity_safety: { score: 0.75, note: 'Good' },
          },
        }}
      />,
    );

    expect(screen.getByText('Routine fit')).toBeInTheDocument();
    expect(screen.getByText('Partial match · 50%')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    const widthNodes = Array.from(container.querySelectorAll('div[style]')).map((node) => node.getAttribute('style'));
    expect(widthNodes).toEqual(expect.arrayContaining(['width: 0%;', 'width: 50%;', 'width: 100%;', 'width: 75%;']));
  });

  it('fires routine deep-dive action for suggested next questions', () => {
    const onAction = vi.fn();
    render(
      <RoutineFitSummaryCard
        language="EN"
        onAction={onAction}
        payload={{
          overall_fit: 'good_match',
          fit_score: 1,
          next_questions: ['What should I adjust first?'],
          dimension_scores: {},
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'What should I adjust first?' }));
    expect(onAction).toHaveBeenCalledWith(
      'chip.aurora.next_action.routine_deep_dive',
      expect.objectContaining({
        reply_text: 'What should I adjust first?',
        trigger_source: 'routine_fit_summary',
      }),
    );
  });

  it('includes dark mode classes on fit summary states', () => {
    const { container } = render(
      <RoutineFitSummaryCard
        language="EN"
        payload={{
          overall_fit: 'needs_adjustment',
          fit_score: 0.2,
          dimension_scores: {
            ingredient_match: { score: 0.2, note: '' },
            routine_completeness: { score: 0.2, note: '' },
            conflict_risk: { score: 0.2, note: '' },
            sensitivity_safety: { score: 0.2, note: '' },
          },
        }}
      />,
    );

    expect(container.innerHTML).toContain('dark:text-red-400');
    expect(container.innerHTML).toContain('dark:bg-red-900/20');
    expect(container.innerHTML).toContain('dark:bg-red-400');
  });
});
