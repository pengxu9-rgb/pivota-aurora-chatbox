import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearChatRecovery, loadChatRecovery, saveChatRecovery } from '@/lib/bffChatRecovery';

const item = (value: unknown): value is string => typeof value === 'string';
const snapshot = {
  uid: 'visitor', briefId: 'brief', traceId: 'trace', items: ['ordinary'],
  threadState: { brand: 'The Ordinary' }, sessionState: 'idle', agentState: 'IDLE_CHAT',
};
beforeEach(() => { sessionStorage.clear(); });
describe('anonymous tab recovery', () => {
  it('round trips transcript and context with the original session identity', () => {
    saveChatRecovery(snapshot);
    expect(loadChatRecovery('visitor', '', item)).toMatchObject(snapshot);
  });
  it('does not restore another explicit brief', () => {
    saveChatRecovery(snapshot);
    expect(loadChatRecovery('visitor', 'other', item)).toBeUndefined();
  });
  it('clears snapshots for a different visitor', () => {
    saveChatRecovery(snapshot);
    expect(loadChatRecovery('other', '', item)).toBeUndefined();
    expect(sessionStorage.length).toBe(0);
  });
  it('expires snapshots after 24 hours', () => {
    vi.useFakeTimers();
    saveChatRecovery(snapshot);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
    expect(loadChatRecovery('visitor', '', item)).toBeUndefined();
    vi.useRealTimers();
  });
  it('fails closed on corrupt data and invalid items', () => {
    saveChatRecovery({ ...snapshot, items: [123] });
    expect(loadChatRecovery('visitor', '', item)).toBeUndefined();
    sessionStorage.setItem('aurora_bff_chat_recovery_v1', '{');
    expect(loadChatRecovery('visitor', '', item)).toBeUndefined();
  });
  it('removes credentials and transient image data', () => {
    saveChatRecovery({ ...snapshot, threadState: { auth_token: 'secret', preview: 'data:image/png;base64,secret', nested: { password: 'secret' } } });
    expect(sessionStorage.getItem('aurora_bff_chat_recovery_v1')).not.toContain('secret');
  });
  it('bounds history and clears oversized snapshots', () => {
    saveChatRecovery({ ...snapshot, items: Array(150).fill('text') });
    expect(loadChatRecovery('visitor', '', item)?.items).toHaveLength(120);
    saveChatRecovery({ ...snapshot, items: ['x'.repeat(1_000_001)] });
    expect(sessionStorage.length).toBe(0);
  });
  it('supports explicit reset and storage denial without crashing', () => {
    saveChatRecovery(snapshot);
    clearChatRecovery();
    expect(loadChatRecovery('visitor', '', item)).toBeUndefined();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => saveChatRecovery(snapshot)).not.toThrow();
    spy.mockRestore();
  });
});
