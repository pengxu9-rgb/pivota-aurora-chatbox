import React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/types';
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
  const queryLabel =
    normalizedQuery ||
    t(isDeparture ? 'travel.dialog.fallback_departure' : 'travel.dialog.fallback_destination', language);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border border-border/70 bg-background p-5">
        <DialogHeader>
          <DialogTitle>{t(isDeparture ? 'travel.dialog.confirm_departure' : 'travel.dialog.confirm_destination', language)}</DialogTitle>
          <DialogDescription>
            {t(isDeparture ? 'travel.dialog.desc_departure' : 'travel.dialog.desc_destination', language, {
              query: queryLabel,
            })}
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
