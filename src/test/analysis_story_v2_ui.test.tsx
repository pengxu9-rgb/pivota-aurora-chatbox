import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisStoryCard } from '@/components/aurora/cards/AnalysisStoryCard';

describe('analysis_story_v2 ui', () => {
  it('renders structured blocks and routine CTA', () => {
    const onAction = vi.fn();
    render(
      <AnalysisStoryCard
        language="EN"
        onAction={onAction}
        payload={{
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
          routine_bridge: {
            missing_fields: ['currentRoutine.am', 'currentRoutine.pm'],
            why_now: 'Need routine to personalize recommendations.',
            cta_label: 'Add AM/PM routine',
            cta_action: 'open_routine_intake',
          },
        }}
      />,
    );

    expect(screen.getByText('Analysis Story')).toBeInTheDocument();
    expect(screen.getByText('Skin profile')).toBeInTheDocument();
    expect(screen.getByText('Priority findings')).toBeInTheDocument();
    expect(screen.getByText('AM plan')).toBeInTheDocument();
    expect(screen.getByText('PM plan')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('analysis-story-routine-cta'));
    expect(onAction).toHaveBeenCalledWith(
      'chip.start.routine',
      expect.objectContaining({
        source_card_type: 'analysis_story_v2',
      }),
    );
  });
});

