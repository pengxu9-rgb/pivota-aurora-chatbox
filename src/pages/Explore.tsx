import React from 'react';
import { Compass, Menu, Sparkles } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';

export default function Explore() {
  const { openSidebar, openComposer } = useOutletContext<MobileShellContext>();

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
        <div className="ios-page-title">Explore</div>
        <div className="ios-header-spacer" />
      </div>

      <div className="ios-panel mt-4">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Compass className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="ios-section-title">Discover answers faster</div>
            <div className="ios-caption mt-1">
              Best practice: start from a goal + a product link (or ingredient list) to reduce back-and-forth.
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-card active:scale-[0.99]"
          onClick={() => openComposer()}
        >
          <Sparkles className="h-4 w-4" />
          Ask a question
        </button>
      </div>
    </div>
  );
}
