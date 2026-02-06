import type { Session } from './types';
import { pivotaJson } from './pivotaApi';

export type QuickProfileProfilePatch = Partial<{
  skin_feel: 'oily' | 'dry' | 'combination' | 'unsure';
  goal_primary: 'breakouts' | 'brightening' | 'antiaging' | 'barrier' | 'spf' | 'other';
  sensitivity_flag: 'yes' | 'no' | 'unsure';
  routine_complexity: '0-2' | '3-5' | '6+';
  rx_flag: 'yes' | 'no' | 'unsure';
}>;

export type SessionProfilePatchResponse = {
  ok: boolean;
  schema_version: string;
  session: {
    schema_version: string;
    profile: Record<string, unknown> | null;
  };
};

export const patchGlowSessionProfile = async (
  session: Pick<Session, 'brief_id' | 'trace_id'>,
  patch: QuickProfileProfilePatch,
) => {
  return await pivotaJson<SessionProfilePatchResponse>(session, '/session/profile/patch', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
};

