import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, Beaker, Camera, Copy, FlaskConical, Search, Sparkles, X } from 'lucide-react';

import { Drawer, DrawerClose, DrawerContent } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import type { ChatHistoryItem } from '@/lib/chatHistory';

type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
  intent: { chip_id?: string; open?: 'photo' | 'routine' };
};

const POPULAR_CONCERNS = ['Acne', 'Anti-aging', 'Dryness', 'Sensitivity', 'Dark spots', 'Pores'];

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'skin_diagnosis',
    title: 'Skin Diagnosis',
    subtitle: 'AI analysis',
    Icon: Sparkles,
    intent: { chip_id: 'chip.start.diagnosis' },
  },
  {
    id: 'photo_analysis',
    title: 'Photo Analysis',
    subtitle: 'Upload & analyze',
    Icon: Camera,
    intent: { open: 'photo' },
  },
  {
    id: 'product_check',
    title: 'Product Check',
    subtitle: 'Evaluate a product',
    Icon: Search,
    intent: { chip_id: 'chip.start.evaluate' },
  },
  {
    id: 'routine_builder',
    title: 'Routine Builder',
    subtitle: 'Build AM/PM',
    Icon: Beaker,
    intent: { chip_id: 'chip.start.routine' },
  },
  {
    id: 'ingredient_science',
    title: 'Ingredient Science',
    subtitle: 'Evidence & mechanism',
    Icon: FlaskConical,
    intent: { chip_id: 'chip.start.ingredients' },
  },
  {
    id: 'dupes',
    title: 'Find Dupes',
    subtitle: 'Cheaper alternatives',
    Icon: Copy,
    intent: { chip_id: 'chip.start.dupes' },
  },
  {
    id: 'checkin',
    title: 'Check-in',
    subtitle: 'Daily check-in',
    Icon: Activity,
    intent: { chip_id: 'chip_checkin_now' },
  },
];

export type ChatStartIntent =
  | { kind: 'query'; title?: string; query: string }
  | { kind: 'chip'; title: string; chip_id: string; open?: 'photo' | 'routine' }
  | { kind: 'open'; title: string; open: 'photo' | 'routine' };

export function ChatComposerDrawer({
  open,
  onOpenChange,
  history,
  defaultQuery,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: ChatHistoryItem[];
  defaultQuery?: string;
  onStart: (intent: ChatStartIntent) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery(String(defaultQuery || '').trim());
  }, [open, defaultQuery]);

  const suggestions = useMemo(() => history.slice(0, 5), [history]);
  const canSubmit = query.trim().length > 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        className={cn(
          'mt-0 h-[calc(100dvh-108px)] max-h-[calc(100dvh-108px)]',
          'sm:h-[92dvh] sm:max-h-[92dvh]',
          'flex flex-col rounded-t-[28px] border border-slate-200 bg-white text-slate-900',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-[var(--aurora-page-x)] pb-2 pt-3">
          <div className="text-[17px] font-semibold tracking-[-0.02em] text-slate-900">Ask Aurora</div>
          <DrawerClose asChild>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
        </div>

        <div className="flex-1 overflow-y-auto px-[var(--aurora-page-x)] pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = query.trim();
              if (!q) return;
              onStart({ kind: 'query', query: q });
              onOpenChange(false);
            }}
            className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-card"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Ask Aurora anything…"
                autoFocus
                inputMode="search"
              />
              <button
                type="submit"
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-full',
                  canSubmit ? 'aurora-home-role-primary' : 'bg-muted text-muted-foreground',
                )}
                disabled={!canSubmit}
                aria-label="Ask"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Popular concerns</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {POPULAR_CONCERNS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-100"
                    onClick={() => setQuery(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </form>

          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Quick actions</div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-card transition hover:bg-slate-50 hover:shadow-card-hover"
                  onClick={() => {
                    const title = a.title;
                    const chipId = a.intent.chip_id;
                    if (chipId) {
                      onStart({ kind: 'chip', title, chip_id: chipId, open: a.intent.open });
                    } else if (a.intent.open) {
                      onStart({ kind: 'open', title, open: a.intent.open });
                    }
                    onOpenChange(false);
                  }}
                >
                  <div className="aurora-home-role-icon inline-flex h-10 w-10 items-center justify-center rounded-2xl border">
                    <a.Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold tracking-[-0.01em] text-slate-900">{a.title}</div>
                    <div className="mt-0.5 text-[12px] text-slate-500">{a.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {suggestions.length ? (
            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Suggestions</div>
              <div className="mt-2 space-y-2">
                {suggestions.map((it) => (
                  <button
                    key={it.brief_id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-left shadow-card transition hover:bg-slate-50 hover:shadow-card-hover"
                    onClick={() => {
                      onStart({ kind: 'query', query: it.title, title: it.title });
                      onOpenChange(false);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium text-slate-900">{it.title}</div>
                      <div className="mt-0.5 text-[12px] text-slate-500">Tap to ask again</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
