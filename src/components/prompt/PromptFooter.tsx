import type { HTMLAttributes } from 'react';

import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import type { Language } from '@/lib/types';
import { cn } from '@/lib/utils';

interface PromptFooterProps extends HTMLAttributes<HTMLDivElement> {
  primaryLabel?: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryAriaLabel?: string;
  tertiaryLabel?: string;
  onTertiary?: () => void;
  tertiaryHidden?: boolean;
  tertiaryAriaLabel?: string;
  language: Language;
  sticky?: boolean;
}

export function PromptFooter({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryAriaLabel,
  tertiaryLabel,
  onTertiary,
  tertiaryHidden = false,
  tertiaryAriaLabel,
  language,
  sticky = false,
  className,
  ...rest
}: PromptFooterProps) {
  const primaryText = primaryLabel || t('prompt.common.continue', language);
  const tertiaryText = tertiaryLabel || t('prompt.common.notNow', language);
  const showTertiary = !tertiaryHidden && typeof onTertiary === 'function';

  return (
    <footer className={cn('prompt-footer', sticky ? 'prompt-footer-sticky' : undefined, className)} {...rest}>
      <Button
        type="button"
        className="prompt-primary-cta"
        disabled={primaryDisabled}
        aria-label={primaryAriaLabel || primaryText}
        onClick={onPrimary}
      >
        {primaryText}
      </Button>

      {showTertiary ? (
        <button
          type="button"
          className="prompt-tertiary-action"
          aria-label={tertiaryAriaLabel || tertiaryText}
          onClick={onTertiary}
        >
          {tertiaryText}
        </button>
      ) : null}
    </footer>
  );
}

