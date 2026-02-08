import React from 'react';
import { Clock, Compass, Heart, HelpCircle, Home, Sparkles, User } from 'lucide-react';

import { NavLink } from '@/components/NavLink';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { ChatHistoryItem } from '@/lib/chatHistory';
import { cn } from '@/lib/utils';

export function AuroraSidebar({
  open,
  onOpenChange,
  history,
  onOpenChat,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: ChatHistoryItem[];
  onOpenChat: (briefId: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[86vw] max-w-sm p-0 [&>button]:hidden">
        <div className="flex h-full flex-col bg-background">
          <div className="border-b border-border/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-foreground">User</div>
                  <div className="text-xs text-muted-foreground">Personal</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            <SideLink to="/" label="Home" Icon={Home} end onNavigate={() => onOpenChange(false)} />
            <SideLink to="/routine" label="My Routine" Icon={Sparkles} end onNavigate={() => onOpenChange(false)} />
            <SideLink to="/favorites" label="Favorites" Icon={Heart} end onNavigate={() => onOpenChange(false)} disabled />
            <SideLink to="/explore" label="Explore" Icon={Compass} end onNavigate={() => onOpenChange(false)} />
            <SideLink to="/help" label="Help Center" Icon={HelpCircle} end onNavigate={() => onOpenChange(false)} disabled />
          </div>

          <div className="px-4 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent</div>

          <div className="flex-1 overflow-y-auto p-2">
            {history.length ? (
              <div className="space-y-1">
                {history.slice(0, 10).map((it) => (
                  <button
                    key={it.brief_id}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left',
                      'hover:bg-muted/50',
                    )}
                    onClick={() => {
                      onOpenChange(false);
                      onOpenChat(it.brief_id);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-foreground">{it.title}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        History
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                No recent chats yet.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SideLink({
  to,
  label,
  Icon,
  end,
  onNavigate,
  disabled,
}: {
  to: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  onNavigate: () => void;
  disabled?: boolean;
}) {
  const base = 'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition';
  if (disabled) {
    return (
      <div className={cn(base, 'cursor-not-allowed opacity-50')}>
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={cn(base, 'text-foreground hover:bg-muted/50')}
      activeClassName="bg-muted/60"
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </NavLink>
  );
}
