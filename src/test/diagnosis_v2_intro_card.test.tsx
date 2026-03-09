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
});
