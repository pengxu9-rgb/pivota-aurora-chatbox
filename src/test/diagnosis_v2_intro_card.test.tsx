import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DiagnosisV2IntroCard } from '@/components/chat/cards/DiagnosisV2IntroCard';

describe('DiagnosisV2IntroCard', () => {
  it('submits the latest goal selection and exposes pressed state', () => {
    const onAction = vi.fn();

    render(
      <DiagnosisV2IntroCard
        language="EN"
        onAction={onAction}
        payload={{
          goal_profile: {
            selected_goals: [],
            custom_input: '',
            constraints: [],
          },
          is_cold_start: true,
          question_strategy: 'default',
          followup_questions: [],
          actions: [],
        }}
      />,
    );

    const barrierRepairButton = screen.getByRole('button', { name: 'Barrier Repair' });
    fireEvent.click(barrierRepairButton);
    fireEvent.click(screen.getByRole('button', { name: 'Start Analysis' }));

    expect(barrierRepairButton).toHaveAttribute('aria-pressed', 'true');
    expect(onAction).toHaveBeenCalledWith('diagnosis_v2_submit', {
      goals: ['barrier_repair'],
      customInput: undefined,
      followupAnswers: {},
    });
  });

  it('renders follow-up options that only have label_en/label_zh (no label field)', () => {
    const onAction = vi.fn();

    render(
      <DiagnosisV2IntroCard
        language="EN"
        onAction={onAction}
        payload={{
          goal_profile: { selected_goals: [], custom_input: '', constraints: [] },
          is_cold_start: true,
          question_strategy: 'default',
          followup_questions: [],
          actions: [],
          sections: [
            {
              type: 'goal_selection',
              options: [{ id: 'hydration', label_en: 'Deep hydration', label_zh: '深层补水' }],
            },
            {
              type: 'follow_up_questions',
              questions: [
                {
                  id: 'q1',
                  question_en: 'Which area bothers you most?',
                  question_zh: '你最在意哪个部位？',
                  options: [
                    { id: 't_zone', label_en: 'T-zone', label_zh: 'T区' },
                    { id: 'cheeks', label_en: 'Cheeks', label_zh: '脸颊' },
                  ],
                },
              ],
            },
          ],
        } as any}
      />,
    );

    expect(screen.getByText('Which area bothers you most?')).toBeInTheDocument();
    expect(screen.getByText('T-zone')).toBeInTheDocument();
    expect(screen.getByText('Cheeks')).toBeInTheDocument();
  });

  it('renders follow-up options that are plain strings (LLM output shape)', () => {
    const onAction = vi.fn();

    render(
      <DiagnosisV2IntroCard
        language="EN"
        onAction={onAction}
        payload={{
          goal_profile: { selected_goals: [], custom_input: '', constraints: [] },
          is_cold_start: true,
          question_strategy: 'default',
          followup_questions: [],
          actions: [],
          sections: [
            {
              type: 'goal_selection',
              options: [{ id: 'hydration', label_en: 'Deep hydration', label_zh: '深层补水' }],
            },
            {
              type: 'follow_up_questions',
              questions: [
                {
                  question_en: 'When do your concerns usually flare up?',
                  options: ['Morning', 'Afternoon', 'Evening'],
                },
              ],
            },
          ],
        } as any}
      />,
    );

    expect(screen.getByText('When do your concerns usually flare up?')).toBeInTheDocument();
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('Afternoon')).toBeInTheDocument();
    expect(screen.getByText('Evening')).toBeInTheDocument();
  });

  it('renders follow-up options with label_zh in CN language mode', () => {
    const onAction = vi.fn();

    render(
      <DiagnosisV2IntroCard
        language="CN"
        onAction={onAction}
        payload={{
          goal_profile: { selected_goals: [], custom_input: '', constraints: [] },
          is_cold_start: true,
          question_strategy: 'default',
          followup_questions: [],
          actions: [],
          sections: [
            {
              type: 'goal_selection',
              options: [{ id: 'hydration', label_en: 'Deep hydration', label_zh: '深层补水' }],
            },
            {
              type: 'follow_up_questions',
              questions: [
                {
                  id: 'q1',
                  question_en: 'Which area?',
                  question_zh: '哪个部位？',
                  options: [
                    { id: 't_zone', label_en: 'T-zone', label_zh: 'T区' },
                  ],
                },
              ],
            },
          ],
        } as any}
      />,
    );

    expect(screen.getByText('哪个部位？')).toBeInTheDocument();
    expect(screen.getByText('T区')).toBeInTheDocument();
  });
});
