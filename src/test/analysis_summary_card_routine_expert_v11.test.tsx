import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisSummaryCard } from '@/components/chat/cards/AnalysisSummaryCard';

const payload = {
  analysis: {
    features: [{ observation: 'Barrier stress', confidence: 'somewhat_sure' as const }],
    strategy: 'Keep routine simple for 7 days.',
    needs_risk_check: false,
    primary_question: '你在涂面霜后刺痛一般持续多久？',
    conditional_followups: ['刺痛是洗后立刻出现，还是涂某一步后出现？'],
    ask_3_questions: ['你在涂面霜后刺痛一般持续多久？', '刺痛是洗后立刻出现，还是涂某一步后出现？', '你更偏油还是偏干？'],
    evidence_refs: [
      {
        id: 'cleanser_ph_barrier_review',
        title: 'JAAD 综述：洁面 pH 与皮肤屏障',
        url: 'https://www.jaad.org/article/S0190-9622(17)31962-X/abstract',
        why_relevant: '高 pH 体系通常不利于屏障稳定。',
      },
    ],
    deepening: {
      phase: 'products' as const,
    },
  },
  session: {} as any,
  photos_provided: false,
  photo_qc: [],
  analysis_source: 'rule_based',
};

describe('AnalysisSummaryCard deepening v1.1 rendering', () => {
  it('renders localized products-phase actions and callbacks', () => {
    const onAction = vi.fn();
    render(<AnalysisSummaryCard payload={payload as any} onAction={onAction} language="CN" />);

    const addProducts = screen.getByRole('button', { name: '填写 AM/PM 产品（更准）' });
    const continueText = screen.getByRole('button', { name: '先继续下一步' });
    expect(addProducts).toBeInTheDocument();
    expect(continueText).toBeInTheDocument();

    fireEvent.click(addProducts);
    expect(onAction).toHaveBeenCalledWith('analysis_review_products');
    fireEvent.click(continueText);
    expect(onAction).toHaveBeenCalledWith('analysis_continue_without_products');
  });

  it('renders ordered analysis sections with followups and evidence refs', () => {
    const onAction = vi.fn();
    render(<AnalysisSummaryCard payload={payload as any} onAction={onAction} language="CN" />);

    const h3s = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent || '');
    const reasoningIdx = h3s.findIndex((t) => t.includes('原因 / 注意 / 修复路径'));
    const priorityIdx = h3s.findIndex((t) => t.includes('当前重点'));
    const nextIdx = h3s.findIndex((t) => t.includes('下一步追问'));
    const evidenceIdx = h3s.findIndex((t) => t.includes('证据来源'));

    expect(reasoningIdx).toBeGreaterThanOrEqual(0);
    expect(priorityIdx).toBeGreaterThan(reasoningIdx);
    expect(nextIdx).toBeGreaterThan(priorityIdx);
    expect(evidenceIdx).toBeGreaterThan(nextIdx);

    expect(screen.getByText('刺痛是洗后立刻出现，还是涂某一步后出现？')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'JAAD 综述：洁面 pH 与皮肤屏障' })).toBeInTheDocument();
  });
});
