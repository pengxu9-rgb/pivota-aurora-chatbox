import type { ReactNode } from 'react';

import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export type PromptPresentationMode = 'inline' | 'sheet' | 'drawer' | 'auto';

interface QuestionPromptProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  presentation?: PromptPresentationMode;
  a11yTitle?: string;
  a11yDescription?: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function QuestionPrompt({
  open = true,
  onOpenChange,
  presentation = 'inline',
  a11yTitle,
  a11yDescription,
  className,
  contentClassName,
  children,
}: QuestionPromptProps) {
  const isMobile = useIsMobile();
  const mode = presentation === 'auto' ? (isMobile ? 'drawer' : 'sheet') : presentation;
  const title = (a11yTitle || 'Question prompt').trim();
  const description = (a11yDescription || 'Question prompt content').trim();

  if (!open) return null;

  if (mode === 'inline') {
    return <section className={cn('prompt-surface', className)}>{children}</section>;
  }

  if (mode === 'drawer') {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn('prompt-drawer-content', className)}>
          <DrawerHeader className="sr-only">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className={cn('prompt-surface prompt-surface-unbordered', contentClassName)}>{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn('prompt-sheet-content', className)}
        aria-label={title}
        a11yTitle={title}
        a11yDescription={description}
      >
        <div className={cn('prompt-surface prompt-surface-unbordered', contentClassName)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}

