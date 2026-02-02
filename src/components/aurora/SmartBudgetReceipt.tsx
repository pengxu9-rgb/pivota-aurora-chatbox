import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ReceiptText, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

import { Language } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export interface BudgetReceiptItem {
  id: string;
  name: string;
  price?: number;
  currency?: string;
}

interface SmartBudgetReceiptProps {
  items: BudgetReceiptItem[];
  optimizedItems?: BudgetReceiptItem[];
  language?: Language;
  periodDays?: number;
  defaultCurrency?: string;
  initialOpen?: boolean;
  initialOptimized?: boolean;
  onOptimizedChange?: (optimized: boolean) => void;
  className?: string;
  floating?: boolean;
}

function formatMoney(value: number | undefined, currency: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function sumKnown(items: BudgetReceiptItem[]) {
  return items.reduce((acc, item) => (typeof item.price === 'number' && Number.isFinite(item.price) ? acc + item.price : acc), 0);
}

function hasUnknown(items: BudgetReceiptItem[]) {
  return items.some((item) => typeof item.price !== 'number' || !Number.isFinite(item.price));
}

export function SmartBudgetReceipt({
  items,
  optimizedItems,
  language = 'EN',
  periodDays = 30,
  defaultCurrency = 'USD',
  initialOpen = false,
  initialOptimized = false,
  onOptimizedChange,
  className,
  floating = true,
}: SmartBudgetReceiptProps) {
  const [open, setOpen] = useState(initialOpen);
  const [optimized, setOptimized] = useState(initialOptimized);

  const currency = useMemo(() => {
    const fromList = [...(items ?? []), ...(optimizedItems ?? [])].find((i) => i.currency)?.currency;
    return (fromList?.trim() || defaultCurrency).toUpperCase();
  }, [defaultCurrency, items, optimizedItems]);

  const baseTotal = useMemo(() => sumKnown(items), [items]);
  const optimizedTotal = useMemo(() => sumKnown(optimizedItems ?? []), [optimizedItems]);
  const visibleItems = optimized && optimizedItems ? optimizedItems : items;
  const visibleTotal = useMemo(() => sumKnown(visibleItems), [visibleItems]);
  const visibleHasUnknown = useMemo(() => hasUnknown(visibleItems), [visibleItems]);
  const savings = useMemo(() => Math.max(0, baseTotal - optimizedTotal), [baseTotal, optimizedTotal]);

  const daily = useMemo(() => {
    const days = Math.max(1, periodDays);
    return visibleTotal / days;
  }, [periodDays, visibleTotal]);

  const title = language === 'EN' ? 'Smart Budget' : '智能预算';
  const optimizeLabel = language === 'EN' ? 'Optimize Budget' : '优化预算';
  const dailyLabel = language === 'EN' ? 'Daily Cost' : '每日成本';
  const totalLabel = language === 'EN' ? 'Total' : '总计';
  const savingsLabel = language === 'EN' ? 'Total Savings' : '总省钱';
  const unknownLabel =
    language === 'EN' ? 'Some prices are missing — totals may be incomplete.' : '部分价格缺失，总计可能不完整。';

  const onToggleOptimized = (next: boolean) => {
    setOptimized(next);
    onOptimizedChange?.(next);
  };

  const anchorClass = floating
    ? 'fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40'
    : '';

  return (
    <div className={cn(anchorClass, className)}>
      <AnimatePresence initial={false}>
        {!open ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <Button
              onClick={() => setOpen(true)}
              className="rounded-full px-4 shadow-lg bg-white/90 text-foreground hover:bg-white border border-border/70 backdrop-blur"
              variant="secondary"
            >
              <ReceiptText className="h-4 w-4 mr-2" />
              {language === 'EN' ? 'Total:' : '总计：'} {formatMoney(visibleTotal, currency)}
              <ChevronUp className="h-4 w-4 ml-2 text-muted-foreground" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          >
            <Card className="w-full max-w-sm bg-white/90 backdrop-blur border-border/70 shadow-elevated overflow-hidden">
              {/* Receipt header */}
              <div className="p-4 pb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-sm shrink-0">
                      <ReceiptText className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {language === 'EN' ? 'Receipt' : '收据'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {language === 'EN'
                          ? 'Anchored on daily cost — optimize without losing signal.'
                          : '以每日成本为锚点，优化预算但不牺牲信息质量。'}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  className="shrink-0 rounded-full"
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              <Separator className="opacity-60" />

              {/* Totals */}
              <div className="p-4 pt-3">
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">{dailyLabel}</p>
                    <motion.p
                      key={`${optimized ? 'opt' : 'base'}_daily`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="text-2xl font-semibold tracking-tight text-foreground font-mono-nums"
                    >
                      {formatMoney(daily, currency)}
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        {language === 'EN' ? '/day' : '/天'}
                      </span>
                    </motion.p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">{totalLabel}</p>
                    <motion.p
                      key={`${optimized ? 'opt' : 'base'}_total`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="text-sm font-medium text-foreground font-mono-nums"
                    >
                      {formatMoney(visibleTotal, currency)}
                    </motion.p>
                  </div>
                </div>

                {/* Optimize toggle */}
                {optimizedItems && optimizedItems.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {optimizeLabel}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {language === 'EN' ? 'Swap in dupes and show savings.' : '切换平替并展示省钱。'}
                      </p>
                    </div>
                    <Switch checked={optimized} onCheckedChange={onToggleOptimized} />
                  </div>
                )}
              </div>

              {/* Receipt list */}
              <div className="px-4 pb-3">
                <div className="rounded-xl border border-border/70 bg-white/70 overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 border-b border-dashed border-border/70 flex items-center justify-between">
                    <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                      {language === 'EN' ? 'Items' : '清单'}
                    </p>
                    <p className="text-[10px] tracking-wider text-muted-foreground uppercase">
                      {language === 'EN' ? 'Price' : '价格'}
                    </p>
                  </div>

                  <ul className="divide-y divide-dashed divide-border/70">
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibleItems.map((item, idx) => {
                        const key = `${item.id}_${optimized ? 'opt' : 'base'}_${idx}`;
                        return (
                          <motion.li
                            key={key}
                            layout
                            initial={{ opacity: 0, x: 18 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -18 }}
                            transition={{ duration: 0.18 }}
                            className="px-3 py-2.5 flex items-center justify-between gap-3"
                          >
                            <p className="text-sm text-foreground truncate">{item.name}</p>
                            <p className="text-sm font-medium text-foreground font-mono-nums shrink-0">
                              {formatMoney(item.price, item.currency?.trim() || currency)}
                            </p>
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                </div>

                {visibleHasUnknown && <p className="mt-2 text-[11px] text-muted-foreground">{unknownLabel}</p>}
              </div>

              {/* Savings footer */}
              <AnimatePresence initial={false}>
                {optimizedItems && optimized && savings > 0 && (
                  <motion.div
                    key="savings"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.18 }}
                    className="px-4 pb-4"
                  >
                    <div className="rounded-xl bg-success/10 border border-success/20 px-3 py-2.5 flex items-center justify-between">
                      <p className="text-sm font-semibold text-success">{savingsLabel}</p>
                      <p className="text-sm font-bold text-success font-mono-nums">
                        {formatMoney(savings, currency)}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

