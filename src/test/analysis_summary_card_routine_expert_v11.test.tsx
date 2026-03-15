import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AnalysisSummaryCard } from '@/components/chat/cards/AnalysisSummaryCard';

const lowConfidencePayload = {
  analysis: {
    features: [{ observation: 'Barrier stress', confidence: 'somewhat_sure' as const }],
    strategy: 'Keep routine simple for 7 days.',
    needs_risk_check: false,
  },
  primary_question: 'Which step feels most uncomfortable right now: cleanser, serum, or moisturizer?',
  ask_3_questions: [
    'Which step feels most uncomfortable right now: cleanser, serum, or moisturizer?',
    'Did you start any new acids, retinoids, or exfoliants in the last 7 days?',
    'Do richer repair creams usually feel soothing for you, or more likely to feel cloggy/irritating?',
  ],
  session: {} as any,
  low_confidence: true,
  photos_provided: false,
  photo_qc: [],
  analysis_source: 'rule_based',
};

const routineExpertPayload = {
  analysis: {
    features: [{ observation: 'Barrier stress', confidence: 'somewhat_sure' as const }],
    strategy: 'Keep routine simple for 7 days.',
    needs_risk_check: false,
    routine_expert: {
      contract: 'aurora.routine_expert.v1',
      snapshot: {
        summary: '屏障优先，先稳住刺激再升级。',
        am_steps: ['早上：温和洁面 + 保湿 + 防晒'],
        pm_steps: ['晚上：温和洁面 + 保湿'],
        active_families: [],
        risk_flags: [],
      },
      key_issues: [
        {
          id: 'barrier_stress',
          title: 'Barrier stress',
          severity: 'high',
          evidence: ['涂面霜后有刺痛感'],
          impact: '先修护屏障，再讨论活性升级。',
          source_ref_ids: ['cleanser_ph_barrier_review'],
        },
      ],
      why_it_happens: ['高 pH 洁面和活性叠加容易让屏障更不稳定。'],
      plan_7d: {
        am: ['早上只保留温和洁面 + 保湿 + 防晒。'],
        pm: ['晚上先暂停强活性，只做修护。'],
        observe_metrics: ['观察刺痛和泛红是否下降。'],
        stop_conditions: ['如果刺痛加重，立即停用强活性。'],
      },
      primary_question: '你在涂面霜后刺痛一般持续多久？',
      conditional_followups: ['刺痛是洗后立刻出现，还是涂某一步后出现？'],
      phase_plan: {
        phase_1_14d: ['前 7-14 天保持极简修护。'],
        phase_2_3_6w: ['耐受稳定后再逐步加回单一活性。'],
      },
      evidence_refs: [
        {
          id: 'cleanser_ph_barrier_review',
          title: 'JAAD 综述：洁面 pH 与皮肤屏障',
          url: 'https://www.jaad.org/article/S0190-9622(17)31962-X/abstract',
          why_relevant: '高 pH 体系通常不利于屏障稳定。',
        },
      ],
      ask_3_questions: [
        '你在涂面霜后刺痛一般持续多久？',
        '刺痛是洗后立刻出现，还是涂某一步后出现？',
        '你更偏油还是偏干？',
      ],
    },
  },
  session: {} as any,
  photos_provided: false,
  photo_qc: [],
  analysis_source: 'rule_based',
};

describe('AnalysisSummaryCard routine expert rendering', () => {
  it('renders the current localized recommendation actions for low-confidence flows', () => {
    const onAction = vi.fn();
    render(<AnalysisSummaryCard payload={lowConfidencePayload as any} onAction={onAction} language="CN" />);

    expect(screen.getByText('Which step feels most uncomfortable right now: cleanser, serum, or moisturizer?')).toBeInTheDocument();
    const recommendations = screen.getByRole('button', { name: '查看产品推荐' });
    const addProducts = screen.getByRole('button', { name: '填写 AM/PM 产品（更准）' });
    expect(recommendations).toBeInTheDocument();
    expect(addProducts).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '先继续下一步' })).not.toBeInTheDocument();

    fireEvent.click(recommendations);
    expect(onAction).toHaveBeenCalledWith('analysis_continue', undefined);
    fireEvent.click(addProducts);
    expect(onAction).toHaveBeenCalledWith('analysis_review_products');
    fireEvent.click(screen.getByRole('button', { name: '是' }));
    expect(screen.getByText('Did you start any new acids, retinoids, or exfoliants in the last 7 days?')).toBeInTheDocument();
  });

  it('renders routine-expert sections and reveals conditional followups after quick check', () => {
    const onAction = vi.fn();
    render(<AnalysisSummaryCard payload={routineExpertPayload as any} onAction={onAction} language="CN" />);

    const h3s = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent || '');
    const phase1Idx = h3s.findIndex((t) => t.includes('Phase 1'));
    const phase2Idx = h3s.findIndex((t) => t.includes('Phase 2'));
    const mechanismIdx = h3s.findIndex((t) => t.includes('机制解释'));
    const evidenceIdx = h3s.findIndex((t) => t.includes('证据来源'));
    const quickCheckIdx = h3s.findIndex((t) => t.includes('快速确认'));

    expect(phase1Idx).toBeGreaterThanOrEqual(0);
    expect(phase2Idx).toBeGreaterThan(phase1Idx);
    expect(mechanismIdx).toBeGreaterThan(phase2Idx);
    expect(evidenceIdx).toBeGreaterThan(mechanismIdx);
    expect(quickCheckIdx).toBeGreaterThan(evidenceIdx);

    fireEvent.click(screen.getByRole('button', { name: '是' }));
    expect(onAction).toHaveBeenCalledWith('analysis_quick_check', { value: 'yes' });
    expect(screen.getByText('刺痛是洗后立刻出现，还是涂某一步后出现？')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'JAAD 综述：洁面 pH 与皮肤屏障' })).toBeInTheDocument();
  });
});
