import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Beaker, Copy, FlaskConical, Search, Sparkles, X } from 'lucide-react';

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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          'mt-0 h-[calc(100dvh-120px)] max-h-[calc(100dvh-120px)]',
          'sm:h-[92dvh] sm:max-h-[92dvh]',
          'flex flex-col rounded-t-3xl border border-border/50 bg-card/95 backdrop-blur-xl',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-2">
          <div className="text-sm font-semibold text-foreground">Ask Aurora</div>
          <DrawerClose asChild>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/70 text-foreground/80"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = query.trim();
              if (!q) return;
              onStart({ kind: 'query', query: q });
              onOpenChange(false);
            }}
            className="rounded-3xl border border-border/50 bg-background/40 p-3 shadow-card"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-background/70 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
                placeholder="Search products, ingredients…"
                autoFocus
                inputMode="search"
              />
              <button
                type="submit"
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-full',
                  canSubmit ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
                disabled={!canSubmit}
                aria-label="Search"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3">
              <div className="section-label">Popular concerns</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {POPULAR_CONCERNS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="rounded-full border border-border/60 bg-background/70 px-3 py-2 text-xs text-foreground/80 hover:bg-background"
                    onClick={() => setQuery(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </form>

          <div className="mt-4">
            <div className="section-label">Quick actions</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="group flex items-start gap-3 rounded-3xl border border-border/50 bg-background/40 p-4 text-left shadow-card transition hover:shadow-card-hover"
                  onClick={() => {
                    const title = a.title;
                    const chipId = a.intent.chip_id;
                    if (chipId) onStart({ kind: 'chip', title, chip_id: chipId, open: a.intent.open });
                    onOpenChange(false);
                  }}
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <a.Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{a.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{a.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {suggestions.length ? (
            <div className="mt-4">
              <div className="section-label">Suggestions</div>
              <div className="mt-2 space-y-2">
                {suggestions.map((it) => (
                  <button
                    key={it.brief_id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-3xl border border-border/50 bg-background/40 px-4 py-3 text-left shadow-card transition hover:shadow-card-hover"
                    onClick={() => {
                      onStart({ kind: 'query', query: it.title, title: it.title });
                      onOpenChange(false);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{it.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Tap to ask again</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
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
