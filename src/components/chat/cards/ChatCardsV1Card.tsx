import React from 'react';
import { cn } from '@/lib/utils';

type Action = {
  type: string;
  label: string;
  payload?: Record<string, unknown>;
};

type Props = {
  cardType: string;
  cardId: string;
  title: string;
  subtitle?: string;
  tags?: string[];
  sections?: Array<Record<string, unknown>>;
  actions?: Action[];
  language: 'EN' | 'CN';
  onAction: (actionId: string, data?: Record<string, unknown>) => void;
};

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const renderItemText = (item: unknown): string => {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  const row = item as Record<string, unknown>;
  const candidates = [
    asString(row.name),
    asString(row.label),
    asString(row.note),
    asString(row.reason),
    asString(row.message),
    asString(row.value),
  ].filter(Boolean);
  if (candidates.length > 0) return candidates.join(' · ');
  try {
    return JSON.stringify(row);
  } catch {
    return '';
  }
};

const renderSection = (section: Record<string, unknown>, key: string) => {
  const title = asString(section.title);
  const items = asArray(section.items).map(renderItemText).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div key={key} className="space-y-1.5">
      {title ? <div className="text-xs font-semibold text-muted-foreground">{title}</div> : null}
      <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.slice(0, 8).map((item, idx) => (
          <li key={`${key}_${idx}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

export function ChatCardsV1Card({
  cardType,
  cardId,
  title,
  subtitle,
  tags,
  sections,
  actions,
  language,
  onAction,
}: Props) {
  const safeTags = asArray(tags).map((row) => asString(row)).filter(Boolean).slice(0, 6);
  const safeSections = asArray(sections).map((row) => (row && typeof row === 'object' && !Array.isArray(row) ? row as Record<string, unknown> : null)).filter(Boolean) as Array<Record<string, unknown>>;
  const safeActions = asArray(actions)
    .map((row) => (row && typeof row === 'object' && !Array.isArray(row) ? row as Action : null))
    .filter(Boolean)
    .slice(0, 4) as Action[];

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3">
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {subtitle ? <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>

      {safeTags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {safeTags.map((tag, idx) => (
            <span key={`${cardId}_tag_${idx}`} className="rounded-full border border-border/50 bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {safeSections.length ? <div className="space-y-3">{safeSections.map((section, idx) => renderSection(section, `${cardId}_sec_${idx}`))}</div> : null}

      {safeActions.length ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {safeActions.map((action, idx) => (
            <button
              key={`${cardId}_action_${idx}`}
              type="button"
              className={cn('chip-button', idx === 0 ? 'chip-button-primary' : 'chip-button-outline')}
              onClick={() =>
                onAction(action.type, {
                  ...(action.payload || {}),
                  source_card_type: cardType,
                  source_card_id: cardId,
                  action_label: action.label,
                })
              }
            >
              {action.label || (language === 'CN' ? '继续' : 'Continue')}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
