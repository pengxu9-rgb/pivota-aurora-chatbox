import React from 'react';
import { Beaker, Menu, Sparkles } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';

export default function Routine() {
  const { openSidebar, startChat } = useOutletContext<MobileShellContext>();

  return (
    <div className="ios-page">
      <div className="ios-page-header">
        <button
          type="button"
          onClick={openSidebar}
          className="ios-nav-button"
          aria-label="Open menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <div className="ios-page-title">My Routine</div>
        <div className="ios-header-spacer" />
      </div>

      <div className="ios-panel mt-4">
        <div className="ios-section-title">Build a routine</div>
        <div className="ios-caption mt-1">Generate an AM/PM plan and iterate with Aurora.</div>

        <button
          type="button"
          className="aurora-home-role-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99]"
          onClick={() => startChat({ kind: 'chip', title: 'Routine Builder', chip_id: 'chip.start.routine', open: 'routine' })}
        >
          <Beaker className="h-4 w-4" />
          Start routine builder
        </button>
      </div>

      <div className="ios-panel-soft mt-3">
        <div className="ios-section-title">Get product recommendations</div>
        <div className="ios-caption mt-1">Tell Aurora your goal (e.g., brightening serum).</div>
        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card active:scale-[0.99]"
          onClick={() => startChat({ kind: 'chip', title: 'Recommendations', chip_id: 'chip.start.reco_products' })}
        >
          <Sparkles className="h-4 w-4" />
          Ask for recommendations
        </button>
      </div>
    </div>
  );
}
