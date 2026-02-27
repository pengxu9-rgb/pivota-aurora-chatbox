import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisSummaryCard } from '@/components/chat/cards/AnalysisSummaryCard';

const payload = {
  analysis: {
    features: [{ observation: 'Barrier stress', confidence: 'somewhat_sure' as const }],
    strategy: 'Keep routine simple for 7 days.',
    needs_risk_check: false,
    routine_expert: {
      contract: 'aurora.routine_expert.v1' as const,
      snapshot: {
        summary: 'AM 2 steps, PM 3 steps.',
        am_steps: ['cleanser: Force Cleanser', 'moisturizer: Hydra Barrier'],
        pm_steps: ['cleanser: Force Cleanser', 'moisturizer: Hydra Barrier'],
        active_families: ['retinoid'],
        risk_flags: ['缺防晒', '清洁过强'],
      },
      key_issues: [
        {
          id: 'hard_stop_cleanser',
          title: '先硬止损：立即停用强清洁/颗粒洁面',
          severity: 'high' as const,
          evidence: ['屏障压力 + 强清洁'],
          impact: '继续使用会放大刺激。',
        },
      ],
      why_it_happens: ['屏障压力期叠加摩擦会加重刺激。'],
      plan_7d: {
        am: ['立刻停用强清洁洁面，改温和洁面。'],
        pm: ['若白天用了防晒，先温和卸除再温和洁面。'],
        observe_metrics: ['刺痛是否下降'],
        stop_conditions: ['若持续刺痛 2 天，回到极简方案'],
      },
      phase_plan: {
        phase_1_14d: ['第 1-14 天先硬止损。'],
        phase_2_3_6w: ['第 3-6 周逐步增加单变量活性。'],
      },
      upgrade_path: [],
      primary_question: '你在涂面霜后刺痛一般持续多久？',
      conditional_followups: ['刺痛是洗后立刻出现，还是涂某一步后出现？'],
      evidence_refs: [
        {
          id: 'cleanser_ph_barrier_review',
          title: 'JAAD 综述：洁面 pH 与皮肤屏障',
          url: 'https://www.jaad.org/article/S0190-9622(17)31962-X/abstract',
          why_relevant: '高 pH 体系通常不利于屏障稳定。',
        },
      ],
      ask_3_questions: ['你在涂面霜后刺痛一般持续多久？', '刺痛是洗后立刻出现，还是涂某一步后出现？', '你更偏油还是偏干？'],
    },
  },
  session: {} as any,
  photos_provided: false,
  photo_qc: [],
  analysis_source: 'rule_based',
};

describe('AnalysisSummaryCard routine expert v1.1 rendering', () => {
  it('renders localized quick-check labels and reveals conditional followups after primary question answer', () => {
    const onAction = vi.fn();
    render(<AnalysisSummaryCard payload={payload as any} onAction={onAction} language="CN" />);

    expect(screen.queryByRole('button', { name: 'Yes' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No' })).toBeNull();
    expect(screen.getByRole('button', { name: '是' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '否' })).toBeInTheDocument();

    expect(screen.queryByText('刺痛是洗后立刻出现，还是涂某一步后出现？')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '是' }));
    expect(onAction).toHaveBeenCalledWith('analysis_quick_check', { value: 'yes' });
    expect(screen.getByText('刺痛是洗后立刻出现，还是涂某一步后出现？')).toBeInTheDocument();
  });

  it('renders ordered expert sections with evidence refs', () => {
    const onAction = vi.fn();
    render(<AnalysisSummaryCard payload={payload as any} onAction={onAction} language="CN" />);

    const h3s = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent || '');
    const keyIdx = h3s.findIndex((t) => t.includes('关键问题'));
    const p1Idx = h3s.findIndex((t) => t.includes('Phase 1'));
    const p2Idx = h3s.findIndex((t) => t.includes('Phase 2'));
    const mechIdx = h3s.findIndex((t) => t.includes('机制解释'));
    const evidenceIdx = h3s.findIndex((t) => t.includes('证据来源'));
    const quickIdx = h3s.findIndex((t) => t.includes('快速确认'));

    expect(keyIdx).toBeGreaterThanOrEqual(0);
    expect(p1Idx).toBeGreaterThan(keyIdx);
    expect(p2Idx).toBeGreaterThan(p1Idx);
    expect(mechIdx).toBeGreaterThan(p2Idx);
    expect(evidenceIdx).toBeGreaterThan(mechIdx);
    expect(quickIdx).toBeGreaterThan(evidenceIdx);

    expect(screen.getByRole('link', { name: 'JAAD 综述：洁面 pH 与皮肤屏障' })).toBeInTheDocument();
  });
});
