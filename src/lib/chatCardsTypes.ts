export type ChatCardV1Type =
  | 'product_verdict'
  | 'compatibility'
  | 'routine'
  | 'triage'
  | 'skin_status'
  | 'effect_review'
  | 'travel'
  | 'nudge';

export type ChatCardActionV1 = {
  type: string;
  label: string;
  payload?: Record<string, unknown>;
};

export type ChatCardV1 = {
  id: string;
  type: ChatCardV1Type;
  priority: number;
  title: string;
  subtitle?: string;
  tags: string[];
  sections: Array<Record<string, unknown>>;
  actions: ChatCardActionV1[];
};

export type QuickReplyV1 = {
  id: string;
  label: string;
  value?: string;
  metadata?: Record<string, unknown>;
};

export type FollowUpQuestionV1 = {
  id: string;
  question: string;
  options: QuickReplyV1[];
  required: boolean;
};

export type ThreadOpV1 = {
  op: 'thread_push' | 'thread_pop' | 'thread_update';
  topic_id: string;
  summary?: string;
  timestamp_ms?: number;
};

export type ChatOpsV1 = {
  thread_ops: ThreadOpV1[];
  profile_patch: Array<Record<string, unknown>>;
  routine_patch: Array<Record<string, unknown>>;
  experiment_events: Array<Record<string, unknown>>;
};

export type ChatSafetyV1 = {
  risk_level: 'none' | 'low' | 'medium' | 'high';
  red_flags: string[];
  disclaimer: string;
};

export type ChatTelemetryV1 = {
  intent: string;
  intent_confidence: number;
  entities: Array<Record<string, unknown>>;
  ui_language?: 'CN' | 'EN';
  matching_language?: 'CN' | 'EN';
  language_mismatch?: boolean;
  language_resolution_source?: 'header' | 'body' | 'text_detected' | 'mixed_override';
};

export type ChatResponseV1 = {
  version: '1.0';
  request_id: string;
  trace_id: string;
  assistant_text: string;
  cards: ChatCardV1[];
  follow_up_questions: FollowUpQuestionV1[];
  suggested_quick_replies: QuickReplyV1[];
  ops: ChatOpsV1;
  safety: ChatSafetyV1;
  telemetry: ChatTelemetryV1;
};
