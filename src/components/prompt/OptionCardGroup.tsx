import { KeyboardEvent, useMemo, useRef } from 'react';

import { cn } from '@/lib/utils';
import { OptionCard } from './OptionCard';
import type { PromptSelectionMode } from './promptTokens';

export type OptionCardGroupOption = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  ariaLabel?: string;
};

type OptionCardGroupValue = string | string[] | null;

interface OptionCardGroupProps {
  selectionMode: PromptSelectionMode;
  options: OptionCardGroupOption[];
  value: OptionCardGroupValue;
  onChange: (nextValue: string | string[]) => void;
  maxSelections?: number;
  ariaLabel: string;
  className?: string;
}

export function OptionCardGroup({
  selectionMode,
  options,
  value,
  onChange,
  maxSelections = Number.POSITIVE_INFINITY,
  ariaLabel,
  className,
}: OptionCardGroupProps) {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const selectedIds = useMemo(() => {
    if (selectionMode === 'single') {
      return typeof value === 'string' && value ? [value] : [];
    }
    return Array.isArray(value) ? value : [];
  }, [selectionMode, value]);

  const handleSelect = (optionId: string) => {
    if (selectionMode === 'single') {
      onChange(optionId);
      return;
    }

    const current = Array.isArray(value) ? value : [];
    if (current.includes(optionId)) {
      onChange(current.filter((entry) => entry !== optionId));
      return;
    }
    if (current.length >= maxSelections) return;
    onChange([...current, optionId]);
  };

  const handleSingleGroupArrowNavigation = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (selectionMode !== 'single') return;

    const key = event.key;
    const isForward = key === 'ArrowRight' || key === 'ArrowDown';
    const isBackward = key === 'ArrowLeft' || key === 'ArrowUp';
    const isHome = key === 'Home';
    const isEnd = key === 'End';
    if (!isForward && !isBackward && !isHome && !isEnd) return;

    const container = groupRef.current;
    if (!container) return;
    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('[data-prompt-option-card="true"]')).filter(
      (node) => !node.disabled,
    );
    if (!options.length) return;

    event.preventDefault();
    const current = event.currentTarget;
    const currentIndex = options.findIndex((node) => node === current);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (isHome) nextIndex = 0;
    else if (isEnd) nextIndex = options.length - 1;
    else if (isForward) nextIndex = (currentIndex + 1) % options.length;
    else if (isBackward) nextIndex = (currentIndex - 1 + options.length) % options.length;

    const nextOption = options[nextIndex];
    nextOption.focus();
    const nextId = nextOption.getAttribute('data-option-id');
    if (nextId) onChange(nextId);
  };

  return (
    <div
      ref={groupRef}
      role={selectionMode === 'single' ? 'radiogroup' : 'group'}
      aria-label={ariaLabel}
      className={cn('prompt-option-group', className)}
    >
      {options.map((option) => (
        <OptionCard
          key={option.id}
          label={option.label}
          description={option.description}
          selected={selectedIds.includes(option.id)}
          disabled={option.disabled}
          selectionMode={selectionMode}
          ariaLabel={option.ariaLabel}
          data-option-id={option.id}
          onKeyDown={handleSingleGroupArrowNavigation}
          onSelect={() => handleSelect(option.id)}
        />
      ))}
    </div>
  );
}
