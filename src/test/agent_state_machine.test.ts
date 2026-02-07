import { describe, expect, it } from 'vitest';

import { inferTextExplicitTransition } from '@/lib/agentStateMachine';

describe('agentStateMachine: inferTextExplicitTransition', () => {
  it('does not treat generic CN "诊断" as diagnosis start', () => {
    const inferred = inferTextExplicitTransition('请诊断一下这款产品适不适合我', 'CN');
    expect(inferred).toBeNull();
  });

  it('treats explicit CN skin diagnosis phrases as diagnosis start', () => {
    const inferred = inferTextExplicitTransition('开始皮肤诊断', 'CN');
    expect(inferred?.requested_next_state).toBe('DIAG_PROFILE');
  });

  it('treats explicit EN diagnosis phrases as diagnosis start even when lang=CN', () => {
    const inferred = inferTextExplicitTransition('Start diagnosis', 'CN');
    expect(inferred?.requested_next_state).toBe('DIAG_PROFILE');
  });

  it('treats explicit EN diagnosis phrases as diagnosis start (lang=EN)', () => {
    const inferred = inferTextExplicitTransition('Please diagnose my skin', 'EN');
    expect(inferred?.requested_next_state).toBe('DIAG_PROFILE');
  });

  it('does not treat non-skin EN "diagnose" usage as diagnosis start', () => {
    const inferred = inferTextExplicitTransition('Can you diagnose this product?', 'EN');
    expect(inferred).toBeNull();
  });
});

