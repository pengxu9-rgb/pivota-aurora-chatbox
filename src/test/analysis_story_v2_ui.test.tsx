import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisStoryCard } from '@/components/aurora/cards/AnalysisStoryCard';

describe('analysis_story_v2 ui', () => {
  it('renders structured sections and routine CTA', () => {
    const onAction = vi.fn();

    render(
      <AnalysisStoryCard
        language="EN"
        onAction={onAction}
        payload={{
          schema_version: 'aurora.analysis_story.v2',
          confidence_overall: 'high',
          skin_profile: {
            skin_type_tendency: 'Combination-dry',
            sensitivity_tendency: 'Mildly sensitive',
            current_strengths: ['Fine texture', 'Low active acne'],
          },
          priority_findings: [
            { priority: 'P1', title: 'Freckle-like pigmentation', area: 'cheeks + nose' },
            { priority: 'P2', title: 'Mild dehydration', area: 'perioral' },
          ],
          target_state: ['More even tone', 'Hydrated glow without shine'],
          core_principles: ['Daily SPF50+', 'One active at a time'],
          am_plan: [{ step: 'Gentle cleanser', purpose: 'Keep barrier stable' }],
          pm_plan: [{ step: 'Azelaic acid 2-3x/week', purpose: 'Tone support' }],
          existing_products_optimization: {
            keep: ['Current gentle cleanser'],
            add: ['Broad-spectrum sunscreen'],
            replace: ['Harsh scrub -> mild exfoliant'],
            remove: ['Fragrance-heavy toner'],
          },
          timeline: ['Week 1: stabilize routine', 'Week 8-12: visible tone improvement'],
          safety_notes: ['Patch test new actives'],
          disclaimer_non_medical: 'Non-medical guidance.',
          routine_bridge: {
            missing_fields: ['am.spf', 'pm.active'],
            cta_text: 'Complete AM/PM routine',
            action_id: 'chip.start.routine',
            reply_text: 'Let me complete AM/PM routine first.',
            why_now: 'Routine context is required for conflict-aware ranking.',
          },
        }}
      />,
    );

    expect(screen.getByText('Personalized skin analysis')).toBeInTheDocument();
    expect(screen.getByText('Priority findings')).toBeInTheDocument();
    expect(screen.getByText('Optimize your existing products')).toBeInTheDocument();
    expect(screen.getByText('Complete AM/PM routine')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Complete AM/PM routine'));
    expect(onAction).toHaveBeenCalledWith(
      'chip.start.routine',
      expect.objectContaining({
        reply_text: 'Let me complete AM/PM routine first.',
        trigger_source: 'analysis_story_v2',
      }),
    );
  });
});
