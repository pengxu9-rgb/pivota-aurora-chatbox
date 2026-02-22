import { useState } from 'react';

import { OptionCardGroup, PromptFooter, PromptHeader } from '@/components/prompt';
import type { Language } from '@/lib/types';

const LONG_HEADER_TITLE =
  'How would you describe your current skin behavior across varying indoor and outdoor conditions throughout a typical workday?';
const LONG_HEADER_HELPER =
  'Choose the option that best reflects your baseline. This intentionally long helper validates two-line clamping and narrow-width readability.';

const SINGLE_OPTIONS = [
  {
    id: 'balanced',
    label:
      'Balanced overall, with mild afternoon shine and occasional dehydration around the cheeks during colder indoor air-conditioning cycles.',
    description:
      'This intentionally verbose description checks multiline option-card wrapping and prevents horizontal clipping.',
  },
  {
    id: 'oily',
    label:
      'Very oily by midday even after a gentle cleanser, especially around the T-zone, with persistent gloss in office lighting.',
  },
  {
    id: 'dry',
    label:
      'Very dry and tight shortly after cleansing, with frequent flaking when humidity drops and heating is active.',
  },
];

const MULTI_OPTIONS = [
  { id: 'redness', label: 'Persistent redness around the nose and cheeks after cleansing' },
  { id: 'breakouts', label: 'Frequent breakouts around chin and jawline during stressful weeks' },
  { id: 'texture', label: 'Uneven texture and occasional rough patches on the forehead' },
];

export default function PromptQAHarness() {
  const language: Language = 'EN';
  const [singleValue, setSingleValue] = useState<string | null>(null);
  const [multiValue, setMultiValue] = useState<string[]>([]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto w-full max-w-[360px]">
        <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-card">
          <p className="mb-3 text-xs text-muted-foreground">Prompt QA Harness (Dev only)</p>
          <div className="max-h-[72vh] overflow-y-auto rounded-2xl border border-border/50 bg-background/35 px-5 pb-2 pt-4">
            <PromptHeader
              title={LONG_HEADER_TITLE}
              helper={LONG_HEADER_HELPER}
              language={language}
              showBack
              onBack={() => undefined}
              step={{ current: 2, total: 5 }}
            />

            <div className="space-y-4 pb-28">
              <OptionCardGroup
                selectionMode="single"
                ariaLabel="Prompt QA single-select"
                options={SINGLE_OPTIONS}
                value={singleValue}
                onChange={(nextValue) => {
                  if (typeof nextValue === 'string') setSingleValue(nextValue);
                }}
              />

              <OptionCardGroup
                selectionMode="multiple"
                ariaLabel="Prompt QA multi-select"
                options={MULTI_OPTIONS}
                value={multiValue}
                onChange={(nextValue) => {
                  if (Array.isArray(nextValue)) setMultiValue(nextValue);
                }}
              />
            </div>

            <PromptFooter
              language={language}
              sticky
              primaryLabel="Continue"
              onPrimary={() => undefined}
              primaryDisabled={!singleValue}
              tertiaryLabel="Not now"
              onTertiary={() => undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
