import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisSummaryCard } from '@/components/chat/cards/AnalysisSummaryCard';

const basePayload = {
  analysis: {
    features: [{ observation: 'Barrier looks irritated', confidence: 'somewhat_sure' as const }],
    strategy: '1) Keep routine simple\n2) Pause strong actives\n3) Re-check in 7 days',
    needs_risk_check: false,
  },
  session: {} as any,
  photos_provided: false,
  photo_qc: [],
  analysis_source: 'rule_based_with_photo_qc',
};

describe('AnalysisSummaryCard actions', () => {
  it('keeps recommendation as primary action under low confidence', () => {
    const onAction = vi.fn();
    render(
      <AnalysisSummaryCard
        payload={{
          ...basePayload,
          low_confidence: true,
        }}
        onAction={onAction}
        language="EN"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'See product recommendations' }));
    expect(onAction).toHaveBeenCalledWith('analysis_continue', undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Add AM/PM products (more accurate)' }));
    expect(onAction).toHaveBeenCalledWith('analysis_review_products');
  });

  it('hides routine-intake shortcut when confidence is not low', () => {
    const onAction = vi.fn();
    render(
      <AnalysisSummaryCard
        payload={{
          ...basePayload,
          low_confidence: false,
        }}
        onAction={onAction}
        language="EN"
      />,
    );

    expect(screen.queryByRole('button', { name: 'Add AM/PM products (more accurate)' })).toBeNull();
  });

  it('supports saved-analysis follow-up overrides for title and product CTA', () => {
    const onAction = vi.fn();
    render(
      <AnalysisSummaryCard
        payload={{
          ...basePayload,
          title: 'Acne next steps from your saved analysis',
          subtitle: 'Based on your saved photo analysis',
          key_takeaways_title: 'What to focus on now',
          plan_title: 'How to approach acne next',
          hide_quick_check: true,
          hide_tuning_actions: true,
          primary_cta_label: 'See acne-safe product recommendations',
          primary_action_id: 'analysis_continue_products',
          primary_action_data: {
            reply_text: 'Based on my saved skin analysis, recommend acne-safe products for me.',
            include_alternatives: true,
            profile_patch: { goals: ['acne'] },
          },
        }}
        onAction={onAction}
        language="EN"
      />,
    );

    expect(screen.getByText('Acne next steps from your saved analysis')).toBeInTheDocument();
    expect(screen.getByText('Based on your saved photo analysis')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'What to focus on now' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'How to approach acne next' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Quick check' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make gentler' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'See acne-safe product recommendations' }));
    expect(onAction).toHaveBeenCalledWith('analysis_continue_products', {
      reply_text: 'Based on my saved skin analysis, recommend acne-safe products for me.',
      include_alternatives: true,
      profile_patch: { goals: ['acne'] },
    });
  });
});
