import React from 'react';
import { Beaker, Menu, Sparkles } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';

export default function Routine() {
  const { openSidebar, startChat } = useOutletContext<MobileShellContext>();

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={openSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-card/80 text-foreground/80 active:scale-[0.97]"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold text-foreground">My Routine</div>
        <div className="h-10 w-10" />
      </div>

      <div className="mt-4 rounded-3xl border border-border/50 bg-card/70 p-5 shadow-card">
        <div className="text-sm font-semibold text-foreground">Build a routine</div>
        <div className="mt-1 text-xs text-muted-foreground">Generate an AM/PM plan and iterate with Aurora.</div>

        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.99]"
          onClick={() => startChat({ kind: 'chip', title: 'Routine Builder', chip_id: 'chip.start.routine', open: 'routine' })}
        >
          <Beaker className="h-4 w-4" />
          Start routine builder
        </button>
      </div>

      <div className="mt-3 rounded-3xl border border-border/50 bg-card/60 p-5 shadow-card">
        <div className="text-sm font-semibold text-foreground">Get product recommendations</div>
        <div className="mt-1 text-xs text-muted-foreground">Tell Aurora your goal (e.g., brightening serum).</div>
        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm font-semibold text-foreground shadow-card active:scale-[0.99]"
          onClick={() => startChat({ kind: 'chip', title: 'Recommendations', chip_id: 'chip.start.reco_products' })}
        >
          <Sparkles className="h-4 w-4" />
          Ask for recommendations
        </button>
      </div>
    </div>
  );
}

