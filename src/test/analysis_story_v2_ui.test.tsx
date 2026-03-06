import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisStoryCard } from '@/components/aurora/cards/AnalysisStoryCard';

describe('analysis_story_v2 ui', () => {
  it('renders structured blocks and analysis-first follow-up actions', () => {
    const onAction = vi.fn();
    render(
      <AnalysisStoryCard
        language="EN"
        onAction={onAction}
        payload={{
          confidence_overall: { level: 'high', score: 0.82 },
          skin_profile: {
            skin_type_tendency: 'combination',
            sensitivity_tendency: 'low',
            current_strengths: ['low inflammation', 'small pores'],
          },
          priority_findings: [{ title: 'Mild redness around cheek' }],
          target_state: ['More stable barrier and even tone'],
          core_principles: ['Stability first'],
          am_plan: [{ step: 'Gentle cleanse', purpose: 'Reduce irritation' }],
          pm_plan: [{ step: 'Barrier moisturizer', purpose: 'Night recovery' }],
          timeline: {
            first_4_weeks: ['Week1 baseline'],
            week_8_12_expectation: ['Observe gradual improvements'],
          },
          safety_notes: ['Pause actives if irritation persists'],
        }}
      />,
    );

    expect(screen.getByText('Personalized skin analysis')).toBeInTheDocument();
    expect(screen.getByText('Confidence: High (82%)')).toBeInTheDocument();
    expect(screen.getByText('Current profile')).toBeInTheDocument();
    expect(screen.getByText('Priority findings')).toBeInTheDocument();
    expect(screen.getByText('AM plan')).toBeInTheDocument();
    expect(screen.getByText('PM plan')).toBeInTheDocument();
    expect(screen.queryByText('Add AM/PM routine')).not.toBeInTheDocument();
    expect(screen.queryByText('See product recommendations')).not.toBeInTheDocument();
    expect(screen.queryByText('Optimize your existing products')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dive deeper into skin' }));
    expect(onAction).toHaveBeenCalledWith(
      'chip.aurora.next_action.deep_dive_skin',
      expect.objectContaining({
        reply_text: 'Tell me more about my skin',
        trigger_source: 'analysis_story_v2',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ingredient plan details' }));
    expect(onAction).toHaveBeenCalledWith(
      'chip.aurora.next_action.ingredient_plan',
      expect.objectContaining({
        reply_text: 'Explain the ingredient plan',
        trigger_source: 'analysis_story_v2',
      }),
    );
  });
});
