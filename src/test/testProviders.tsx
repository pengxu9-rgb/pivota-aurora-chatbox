import React from 'react';
import { render as rtlRender, type RenderOptions } from '@testing-library/react';

import { LanguageProvider } from '@/contexts/LanguageContext';

function Providers({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

export function render(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return rtlRender(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
