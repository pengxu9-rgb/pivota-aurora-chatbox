import React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Language } from '@/lib/pivotaAgentBff';
import type { DestinationPlace, TravelPlaceField } from '@/lib/travelPlansApi';

function buildPlaceMeta(place: DestinationPlace) {
  return [place.admin1, place.country].filter(Boolean).join(' · ');
}

export function DestinationDisambiguationDialog({
  open,
  language,
  field = 'destination',
  normalizedQuery,
  candidates,
  submitting,
  onSelect,
  onOpenChange,
}: {
  open: boolean;
  language: Language;
  field?: TravelPlaceField;
  normalizedQuery: string;
  candidates: DestinationPlace[];
  submitting?: boolean;
  onSelect: (candidate: DestinationPlace) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const isDeparture = field === 'departure';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border border-border/70 bg-background p-5">
        <DialogHeader>
          <DialogTitle>{language === 'CN' ? (isDeparture ? '确认出发地' : '确认目的地') : isDeparture ? 'Confirm departure' : 'Confirm destination'}</DialogTitle>
          <DialogDescription>
            {language === 'CN'
              ? `“${normalizedQuery || (isDeparture ? '该出发地' : '该地名')}”存在多个候选，请选择一个确定地点后继续。`
              : `"${normalizedQuery || (isDeparture ? 'This departure location' : 'This destination')}" matches multiple places. Pick the exact one to continue.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {candidates.slice(0, 5).map((candidate) => {
            const meta = buildPlaceMeta(candidate);
            return (
              <button
                key={`${candidate.label}_${candidate.latitude}_${candidate.longitude}`}
                type="button"
                className="flex w-full items-start justify-between rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
                onClick={() => onSelect(candidate)}
                disabled={Boolean(submitting)}
              >
                <div>
                  <div className="text-sm font-semibold text-foreground">{candidate.label}</div>
                  {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
                </div>
                {candidate.timezone ? (
                  <div className="shrink-0 text-[11px] text-muted-foreground">{candidate.timezone}</div>
                ) : null}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
