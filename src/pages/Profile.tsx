import React from 'react';
import { Menu, User } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';

export default function Profile() {
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
        <div className="text-base font-semibold text-foreground">Profile</div>
        <div className="h-10 w-10" />
      </div>

      <div className="mt-4 rounded-3xl border border-border/50 bg-card/70 p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Quick profile</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Best practice: complete the 30‑sec quick profile once so Aurora can personalize recommendations.
            </div>
          </div>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-card active:scale-[0.99]"
          onClick={() => startChat({ kind: 'chip', title: 'Quick Profile', chip_id: 'chip_quick_profile' })}
        >
          Start quick profile
        </button>
      </div>
    </div>
  );
}

