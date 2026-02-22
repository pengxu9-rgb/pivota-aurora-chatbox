import React from 'react';
import { CalendarDays, Menu, Sparkles } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';

export default function Plans() {
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
        <div className="ios-page-title">Plans</div>
        <div className="ios-header-spacer" />
      </div>

      <div className="ios-panel mt-4">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <CalendarDays className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="ios-section-title">Plan next week</div>
            <div className="ios-caption mt-1">
              Tell Aurora your schedule (travel, workouts, sun exposure) and get a plan with AM/PM adjustments.
            </div>
          </div>
        </div>

        <button
          type="button"
          className="aurora-home-role-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99]"
          onClick={() =>
            startChat({
              kind: 'query',
              title: 'Next-week plan',
              query:
                "Help me plan my skincare for next week. Here's my schedule: (travel/workouts/sun exposure). Please adjust AM/PM routine and warn about conflicts.",
            })
          }
        >
          <Sparkles className="h-4 w-4" />
          Build my plan
        </button>
      </div>
    </div>
  );
}
