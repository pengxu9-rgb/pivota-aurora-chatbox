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
  it('shows photo-optin actions under low confidence default phase', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Upload selfie for deeper analysis' }));
    expect(onAction).toHaveBeenCalledWith('analysis_upload_selfie');

    fireEvent.click(screen.getByRole('button', { name: 'Skip photo and continue' }));
    expect(onAction).toHaveBeenCalledWith('analysis_skip_photo');
  });

  it('shows recommendation CTA in refined phase', () => {
    const onAction = vi.fn();
    render(
      <AnalysisSummaryCard
        payload={{
          ...basePayload,
          low_confidence: false,
          analysis: {
            ...basePayload.analysis,
            deepening: { phase: 'refined' },
          },
        }}
        onAction={onAction}
        language="EN"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'See product recommendations' }));
    expect(onAction).toHaveBeenCalledWith('analysis_continue');
  });
});
