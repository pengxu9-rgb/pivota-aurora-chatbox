import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  DiagnosisV2ResultPayload, DiagnosisV2PhotoPromptPayload,
  DiagnosisV2LoginPromptPayload, DiagnosisV2ThinkingStep, Language,
} from '@/lib/types';
import { DiagnosisV2ResultCard } from '@/components/chat/cards/DiagnosisV2ResultCard';
import { DiagnosisV2PhotoPromptCard } from '@/components/chat/cards/DiagnosisV2PhotoPromptCard';
import { DiagnosisV2LoginPromptCard } from '@/components/chat/cards/DiagnosisV2LoginPromptCard';
import { DiagnosisV2ThinkingCard } from '@/components/chat/cards/DiagnosisV2ThinkingCard';
import { adaptChatCardForRichRender } from '@/lib/chatCardsAdapters';

const result: DiagnosisV2ResultPayload = {
  diagnosis_id: 'b1f588e0-5204-4972-a594-bf5422788d03', diagnosis_seq: 1,
  goal_profile: { selected_goals: ['barrier_repair'], constraints: [] },
  is_cold_start: false,
  data_quality: { overall: 'low', limits_banner: 'Limited information' },
  inferred_state: { axes: [{
    axis: 'hydration_level', level: 'moderate', confidence: 0.5,
    evidence: ['User report'], trend: 'stable', previous_level: 'moderate',
  }] },
  strategies: [{ title: 'Keep a simple routine', why: 'Reduce complexity', timeline: 'Review later', do_list: ['Track changes'], avoid_list: [] }],
  routine_blueprint: { am_steps: ['Cleanse'], pm_steps: ['Moisturize'], conflict_rules: [] },
  improvement_path: [{ tip: 'Add context', action_type: 'take_photo', action_label: 'Add photo' }],
  next_actions: [{ type: 'setup_routine', label: 'Set up routine', payload: { diagnosis_id: 'fixture' } }],
};

describe('diagnosis V2 wire contract consumers', () => {
  it('preserves the result contract through adaptation and dispatches type/payload actions', () => {
    const hit = adaptChatCardForRichRender({ cardType: 'diagnosis_v2_result', payload: result, language: 'EN' });
    expect(hit?.kind).toBe('diagnosis_v2_result');
    const onAction = vi.fn();
    render(<DiagnosisV2ResultCard payload={result} language="EN" onAction={onAction} />);
    expect(screen.getByText('Limited information')).toBeVisible();
    expect(screen.getByText('Hydration level')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Set up routine' }));
    expect(onAction).toHaveBeenCalledWith('setup_routine', { diagnosis_id: 'fixture' });
    fireEvent.click(screen.getByRole('button', { name: 'Add photo' }));
    expect(onAction).toHaveBeenCalledWith('take_photo', { tip: result.improvement_path[0] });
  });

  it.each<Language>(['FR', 'DE', 'JA'])('uses English fallback labels for %s', (language) => {
    render(<DiagnosisV2ResultCard payload={result} language={language} onAction={vi.fn()} />);
    expect(screen.getByText('Hydration level')).toBeVisible();
    expect(screen.getByText('Moderate')).toBeVisible();
  });

  it('retains Chinese labels', () => {
    render(<DiagnosisV2ResultCard payload={result} language="CN" onAction={vi.fn()} />);
    expect(screen.getByText('保湿水平')).toBeVisible();
    expect(screen.getByText('中')).toBeVisible();
  });

  it('renders typed progress events with an English fallback', () => {
    const steps: DiagnosisV2ThinkingStep[] = [{ stage: 'inference', step: 'review', text: 'Reviewing inputs', status: 'in_progress' }];
    render(<DiagnosisV2ThinkingCard steps={steps} language="FR" />);
    expect(screen.getByText('Analyzing skin state')).toBeVisible();
    expect(screen.getByText('Reviewing inputs')).toBeVisible();
  });

  it('keeps photo opt-in and skip separate', () => {
    const payload: DiagnosisV2PhotoPromptPayload = {
      prompt_text: 'Optional photo', has_existing_artifact: false,
      photo_action: { type: 'take_photo', label: 'Take photo' },
      skip_action: { type: 'skip_photo', label: 'Skip photo' },
    };
    const onAction = vi.fn();
    render(<DiagnosisV2PhotoPromptCard payload={payload} language="EN" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip photo' }));
    expect(onAction).toHaveBeenCalledWith('skip_photo', {});
    fireEvent.click(screen.getByRole('button', { name: 'Take photo' }));
    expect(onAction).toHaveBeenCalledWith('take_photo', {});
  });

  it('preserves login action payloads', () => {
    const payload: DiagnosisV2LoginPromptPayload = {
      prompt_text: 'Save your progress', pending_goals: ['barrier_repair'],
      login_action: { type: 'login_then_diagnose', label: 'Sign in', payload: { goals: ['barrier_repair'] } },
      skip_action: { type: 'skip_login', label: 'Continue anonymously', payload: {} },
    };
    const onAction = vi.fn();
    render(<DiagnosisV2LoginPromptCard payload={payload} language="EN" onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onAction).toHaveBeenCalledWith('login_then_diagnose', { goals: ['barrier_repair'] });
  });
});
