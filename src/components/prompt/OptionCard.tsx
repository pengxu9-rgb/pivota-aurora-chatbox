import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { PromptSelectionMode } from './promptTokens';

export interface OptionCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  selectionMode: PromptSelectionMode;
  ariaLabel?: string;
}

export function OptionCard({
  label,
  description,
  selected,
  disabled,
  onSelect,
  selectionMode,
  ariaLabel,
  className,
  onClick,
  ...rest
}: OptionCardProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    onSelect();
  };

  return (
    <button
      type="button"
      role={selectionMode === 'single' ? 'radio' : 'checkbox'}
      aria-checked={selected}
      aria-label={ariaLabel || label}
      data-prompt-option-card="true"
      className={cn(
        'prompt-option-card',
        description ? 'prompt-option-card-multiline' : undefined,
        selected ? 'prompt-option-card-selected' : undefined,
        disabled ? 'prompt-option-card-disabled' : undefined,
        className,
      )}
      disabled={disabled}
      onClick={handleClick}
      {...rest}
    >
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-medium text-foreground">{label}</span>
          {description ? <span className="mt-0.5 block break-words text-xs text-muted-foreground">{description}</span> : null}
        </span>
        <span
          aria-hidden="true"
          className={cn('prompt-option-card-check', selected ? 'prompt-option-card-check-selected' : undefined)}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}
