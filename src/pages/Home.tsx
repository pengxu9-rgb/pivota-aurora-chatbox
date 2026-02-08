import React from 'react';
import { Bell, Camera, Menu, Sparkles, TestTubeDiagonal, Workflow } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { cn } from '@/lib/utils';

export default function Home() {
  const { openSidebar, openComposer, startChat } = useOutletContext<MobileShellContext>();

  return (
    <div className="px-4 pt-4">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-blue-500 p-5 text-white shadow-elevated">
        <div className="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent" />

        <div className="relative flex items-center justify-between">
          <button
            type="button"
            onClick={openSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur active:scale-[0.97]"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur active:scale-[0.97]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mt-8 text-center">
          <div className="text-2xl font-semibold">Your AI Skin Consultant</div>
          <div className="mt-1 text-xs text-white/80">Powered by Aurora v4.0</div>
        </div>

        <div className="relative mt-6 flex flex-wrap justify-center gap-2">
          <Pill
            label="Skin Diagnosis"
            onClick={() => startChat({ kind: 'chip', title: 'Skin Diagnosis', chip_id: 'chip.start.diagnosis' })}
          />
          <Pill
            label="My Routine"
            onClick={() => startChat({ kind: 'chip', title: 'Routine Builder', chip_id: 'chip.start.routine', open: 'routine' })}
          />
          <Pill
            label="Product Check"
            onClick={() => startChat({ kind: 'chip', title: 'Product Check', chip_id: 'chip.start.evaluate' })}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => openComposer()}
        className={cn(
          'mt-4 flex w-full items-center gap-3 rounded-3xl border border-border/50 bg-card/90 px-4 py-4 shadow-card',
          'text-left backdrop-blur transition hover:shadow-card-hover active:scale-[0.99]',
        )}
        aria-label="Open chat"
      >
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">Ask Aurora</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">Search products, ingredients, routines…</div>
        </div>
        <div className="text-xs text-muted-foreground">Tap</div>
      </button>

      <div className="mt-4">
        <div className="section-label">Quick actions</div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <ActionCard
            title="Skin Diagnosis"
            subtitle="AI analysis"
            Icon={TestTubeDiagonal}
            onClick={() => startChat({ kind: 'chip', title: 'Skin Diagnosis', chip_id: 'chip.start.diagnosis' })}
          />
          <ActionCard
            title="Photo Analysis"
            subtitle="Upload & analyze"
            Icon={Camera}
            onClick={() => startChat({ kind: 'open', title: 'Photo Analysis', open: 'photo' })}
          />
          <ActionCard
            title="Routine Analysis"
            subtitle="AM/PM intake"
            Icon={Workflow}
            onClick={() => startChat({ kind: 'open', title: 'Routine Analysis', open: 'routine' })}
          />
          <ActionCard
            title="Product Check"
            subtitle="Evaluate a product"
            Icon={Sparkles}
            onClick={() => startChat({ kind: 'chip', title: 'Product Check', chip_id: 'chip.start.evaluate' })}
          />
        </div>
      </div>
    </div>
  );
}

function Pill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/15 active:scale-[0.98]"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ActionCard({
  title,
  subtitle,
  Icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group flex items-start gap-3 rounded-3xl border border-border/50 bg-card/70 p-4 text-left shadow-card transition hover:shadow-card-hover active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}
