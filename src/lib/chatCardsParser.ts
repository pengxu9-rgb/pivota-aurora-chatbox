import type { Card, SuggestedChip, V1Envelope } from './pivotaAgentBff';
import type { ChatCardV1, ChatResponseV1, FollowUpQuestionV1, QuickReplyV1 } from './chatCardsTypes';

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asArray = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const asStringArray = (value: unknown, limit = 8): string[] => {
  const out: string[] = [];
  for (const row of asArray(value)) {
    const text = asString(row);
    if (!text) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
};

const CARD_TYPES = new Set([
  'product_verdict',
  'compatibility',
  'routine',
  'triage',
  'skin_status',
  'effect_review',
  'travel',
  'nudge',
]);

const normalizeQuickReply = (raw: unknown, fallbackId: string): QuickReplyV1 | null => {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id) || fallbackId;
  const label = asString(row.label);
  if (!id || !label) return null;
  const value = asString(row.value) || undefined;
  const metadata = asRecord(row.metadata) || undefined;
  return {
    id: id.slice(0, 120),
    label: label.slice(0, 120),
    ...(value ? { value: value.slice(0, 300) } : {}),
    ...(metadata ? { metadata } : {}),
  };
};

const normalizeFollowUp = (raw: unknown, fallbackId: string): FollowUpQuestionV1 | null => {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id) || fallbackId;
  const question = asString(row.question);
  if (!id || !question) return null;
  const options = asArray(row.options)
    .map((item, idx) => normalizeQuickReply(item, `${id}_opt_${idx + 1}`))
    .filter(Boolean) as QuickReplyV1[];
  return {
    id: id.slice(0, 120),
    question: question.slice(0, 500),
    options: options.slice(0, 3),
    required: row.required === true,
  };
};

const normalizeCardAction = (raw: unknown, fallbackId: string) => {
  const row = asRecord(raw);
  if (!row) return null;
  const type = asString(row.type);
  const label = asString(row.label);
  if (!type || !label) return null;
  const payload = asRecord(row.payload) || undefined;
  return {
    type: type.slice(0, 120),
    label: label.slice(0, 120),
    ...(payload ? { payload } : {}),
    _id: fallbackId,
  };
};

const normalizeCard = (raw: unknown, fallbackId: string): ChatCardV1 | null => {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id) || fallbackId;
  const type = asString(row.type).toLowerCase() as ChatCardV1['type'];
  const title = asString(row.title);
  if (!id || !type || !title || !CARD_TYPES.has(type)) return null;

  const priorityRaw = Number(row.priority);
  const priority = Number.isFinite(priorityRaw) ? Math.max(1, Math.min(3, Math.trunc(priorityRaw))) : 2;
  const subtitle = asString(row.subtitle) || undefined;
  const tags = asStringArray(row.tags, 8);
  const sections = asArray(row.sections)
    .map((section) => asRecord(section))
    .filter(Boolean) as Array<Record<string, unknown>>;
  const actions = asArray(row.actions)
    .map((action, idx) => normalizeCardAction(action, `${id}_action_${idx + 1}`))
    .filter(Boolean)
    .map(({ _id: _ignored, ...action }) => action) as ChatCardV1['actions'];

  return {
    id: id.slice(0, 120),
    type,
    priority,
    title: title.slice(0, 200),
    ...(subtitle ? { subtitle: subtitle.slice(0, 200) } : {}),
    tags,
    sections,
    actions,
  };
};

export const parseChatResponseV1 = (input: unknown): ChatResponseV1 | null => {
  const root = asRecord(input);
  if (!root) return null;
  if (asString(root.version) !== '1.0') return null;

  const requestId = asString(root.request_id);
  const traceId = asString(root.trace_id);
  if (!requestId || !traceId) return null;

  const assistantText = asString(root.assistant_text);
  const cards = asArray(root.cards)
    .map((card, idx) => normalizeCard(card, `card_${idx + 1}`))
    .filter(Boolean) as ChatCardV1[];
  const followUps = asArray(root.follow_up_questions)
    .map((question, idx) => normalizeFollowUp(question, `fup_${idx + 1}`))
    .filter(Boolean) as FollowUpQuestionV1[];
  const quickReplies = asArray(root.suggested_quick_replies)
    .map((reply, idx) => normalizeQuickReply(reply, `quick_${idx + 1}`))
    .filter(Boolean) as QuickReplyV1[];

  const opsRaw = asRecord(root.ops) || {};
  const safetyRaw = asRecord(root.safety) || {};
  const telemetryRaw = asRecord(root.telemetry) || {};

  const riskLevelRaw = asString(safetyRaw.risk_level).toLowerCase();
  const riskLevel: ChatResponseV1['safety']['risk_level'] =
    riskLevelRaw === 'high' || riskLevelRaw === 'medium' || riskLevelRaw === 'low' ? riskLevelRaw : 'none';
  const telemetryConfidenceRaw = Number(telemetryRaw.intent_confidence);
  const telemetryUiLanguage = (() => {
    const token = asString(telemetryRaw.ui_language).toUpperCase();
    if (token === 'CN' || token === 'EN') return token as 'CN' | 'EN';
    return undefined;
  })();
  const telemetryMatchingLanguage = (() => {
    const token = asString(telemetryRaw.matching_language).toUpperCase();
    if (token === 'CN' || token === 'EN') return token as 'CN' | 'EN';
    return undefined;
  })();
  const telemetryResolutionSource = (() => {
    const token = asString(telemetryRaw.language_resolution_source).toLowerCase();
    if (token === 'header' || token === 'body' || token === 'text_detected' || token === 'mixed_override') {
      return token as 'header' | 'body' | 'text_detected' | 'mixed_override';
    }
    return undefined;
  })();
  const telemetryLanguageMismatch =
    typeof telemetryRaw.language_mismatch === 'boolean'
      ? telemetryRaw.language_mismatch
      : telemetryUiLanguage && telemetryMatchingLanguage
        ? telemetryUiLanguage !== telemetryMatchingLanguage
        : false;

  return {
    version: '1.0',
    request_id: requestId,
    trace_id: traceId,
    assistant_text: assistantText,
    cards: cards.slice(0, 3),
    follow_up_questions: followUps.slice(0, 3),
    suggested_quick_replies: quickReplies.slice(0, 8),
    ops: {
      thread_ops: asArray(opsRaw.thread_ops)
        .map((item) => asRecord(item))
        .filter(Boolean)
        .map((item) => ({
          op: (asString(item.op) || 'thread_update') as 'thread_push' | 'thread_pop' | 'thread_update',
          topic_id: asString(item.topic_id) || 'unknown',
          ...(asString(item.summary) ? { summary: asString(item.summary).slice(0, 220) } : {}),
          ...(Number.isFinite(Number(item.timestamp_ms)) ? { timestamp_ms: Math.max(0, Math.trunc(Number(item.timestamp_ms))) } : {}),
        }))
        .slice(0, 4),
      profile_patch: asArray(opsRaw.profile_patch)
        .map((item) => asRecord(item))
        .filter(Boolean)
        .slice(0, 4) as Array<Record<string, unknown>>,
      routine_patch: asArray(opsRaw.routine_patch)
        .map((item) => asRecord(item))
        .filter(Boolean)
        .slice(0, 4) as Array<Record<string, unknown>>,
      experiment_events: asArray(opsRaw.experiment_events)
        .map((item) => asRecord(item))
        .filter(Boolean)
        .slice(0, 8) as Array<Record<string, unknown>>,
    },
    safety: {
      risk_level: riskLevel,
      red_flags: asStringArray(safetyRaw.red_flags, 8),
      disclaimer: asString(safetyRaw.disclaimer),
    },
    telemetry: {
      intent: asString(telemetryRaw.intent) || 'unknown',
      intent_confidence: Number.isFinite(telemetryConfidenceRaw)
        ? Math.max(0, Math.min(1, telemetryConfidenceRaw))
        : 0,
      entities: asArray(telemetryRaw.entities)
        .map((item) => asRecord(item))
        .filter(Boolean)
        .slice(0, 16) as Array<Record<string, unknown>>,
      ...(telemetryUiLanguage ? { ui_language: telemetryUiLanguage } : {}),
      ...(telemetryMatchingLanguage ? { matching_language: telemetryMatchingLanguage } : {}),
      ...(typeof telemetryRaw.language_mismatch === 'boolean' || (telemetryUiLanguage && telemetryMatchingLanguage)
        ? { language_mismatch: telemetryLanguageMismatch }
        : {}),
      ...(telemetryResolutionSource ? { language_resolution_source: telemetryResolutionSource } : {}),
    },
  };
};

const quickReplyToChip = (reply: QuickReplyV1): SuggestedChip => {
  return {
    chip_id: `quick_${reply.id}`,
    label: reply.label,
    kind: 'quick_reply',
    data: {
      ...(reply.metadata || {}),
      reply_text: reply.value || reply.label,
      trigger_source: 'chip',
    },
  };
};

const followUpQuestionToChips = (question: FollowUpQuestionV1): SuggestedChip[] => {
  if (!Array.isArray(question.options) || question.options.length === 0) return [];
  return question.options.slice(0, 3).map((option) => ({
    chip_id: `fup_${question.id}_${option.id}`,
    label: option.label,
    kind: 'quick_reply',
    data: {
      ...(option.metadata || {}),
      follow_up_id: question.id,
      follow_up_question: question.question,
      follow_up_required: question.required,
      reply_text: option.value || option.label,
      trigger_source: 'chip',
    },
  }));
};

const cardToLegacy = (card: ChatCardV1, response: ChatResponseV1): Card => {
  const payload: Record<string, unknown> = {
    title: card.title,
    ...(card.subtitle ? { subtitle: card.subtitle } : {}),
    priority: card.priority,
    tags: card.tags,
    sections: card.sections,
    actions: card.actions,
    safety: response.safety,
    telemetry: response.telemetry,
  };
  return {
    card_id: card.id,
    type: card.type,
    title: card.title,
    payload,
  };
};

export const chatResponseV1ToEnvelope = (response: ChatResponseV1): V1Envelope => {
  const cards = response.cards.map((card) => cardToLegacy(card, response));
  const chips = [
    ...response.suggested_quick_replies.map(quickReplyToChip),
    ...response.follow_up_questions.flatMap(followUpQuestionToChips),
  ].slice(0, 12);

  const sessionPatch: Record<string, unknown> = {
    chat_v1: {
      safety: response.safety,
      telemetry: response.telemetry,
    },
  };
  if (response.ops.profile_patch[0]) sessionPatch.profile = response.ops.profile_patch[0];
  if (response.ops.routine_patch[0]) sessionPatch.routine_patch = response.ops.routine_patch[0];
  if (response.ops.thread_ops.length > 0) sessionPatch.thread_ops = response.ops.thread_ops;
  if (response.ops.experiment_events.length > 0) sessionPatch.experiment_events = response.ops.experiment_events;

  const events: Array<Record<string, unknown>> = [
    {
      event_name: 'intent_detected',
      data: {
        intent: response.telemetry.intent,
        confidence: response.telemetry.intent_confidence,
      },
    },
    ...response.ops.thread_ops.map((op) => ({
      event_name: op.op,
      data: {
        topic_id: op.topic_id,
        ...(op.summary ? { summary: op.summary } : {}),
        ...(typeof op.timestamp_ms === 'number' ? { timestamp_ms: op.timestamp_ms } : {}),
      },
    })),
    ...(response.ops.profile_patch.length || response.ops.routine_patch.length || response.ops.experiment_events.length
      ? [{ event_name: 'memory_written', data: {
        profile: response.ops.profile_patch.length,
        routine: response.ops.routine_patch.length,
        experiments: response.ops.experiment_events.length,
      } }]
      : []),
  ];

  return {
    request_id: response.request_id,
    trace_id: response.trace_id,
    assistant_message: {
      role: 'assistant',
      content: response.assistant_text,
      format: 'markdown',
    },
    suggested_chips: chips,
    cards,
    session_patch: sessionPatch,
    events,
  };
};
