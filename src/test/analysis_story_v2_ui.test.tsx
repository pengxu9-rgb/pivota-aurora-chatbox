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
          ui_card_v1: {
            headline: 'Photo review highlights forehead redness and under-eye texture first.',
            key_points: ['Redness is most visible across the forehead.', 'Texture stands out more under the eyes.'],
            actions_now: ['AM: Gentle cleanse', 'PM: Single core active (low frequency)'],
            avoid_now: ['Do not stack multiple strong actives in the same night.'],
            next_checkin: 'Week 1: retake the same angles in even lighting.',
          },
          confidence_overall: { level: 'high', score: 0.82 },
          skin_profile: {
            skin_type_tendency: 'combination',
            sensitivity_tendency: 'low',
            current_strengths: ['Redness is most visible across the forehead.', 'small pores'],
          },
          priority_findings: [
            { title: 'Redness is most visible across the forehead.' },
            { title: 'Mild redness around cheek' },
          ],
          target_state: ['Photo review highlights forehead redness and under-eye texture first.', 'More stable barrier and even tone'],
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

    expect(screen.getByText('Skin analysis')).toBeInTheDocument();
    expect(screen.getByText('Photo-led')).toBeInTheDocument();
    expect(screen.getByText('Photo review highlights forehead redness and under-eye texture first.')).toBeInTheDocument();
    expect(screen.getByText('Confidence: High (82%)')).toBeInTheDocument();
    expect(screen.getByText('What stands out')).toBeInTheDocument();
    expect(screen.getByText('Do now')).toBeInTheDocument();
    expect(screen.getByText('Hold for now')).toBeInTheDocument();
    expect(screen.getByText('Next check-in')).toBeInTheDocument();
    expect(screen.queryByText('Current profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Priority findings')).not.toBeInTheDocument();
    expect(screen.queryByText('Target state')).not.toBeInTheDocument();
    expect(screen.queryByText('Mild redness around cheek')).not.toBeInTheDocument();
    expect(screen.getAllByText('Redness is most visible across the forehead.')).toHaveLength(1);
    expect(screen.getAllByText('Photo review highlights forehead redness and under-eye texture first.')).toHaveLength(1);
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
