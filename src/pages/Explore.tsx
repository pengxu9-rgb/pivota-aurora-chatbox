import React from 'react';
import { Compass, Menu, Sparkles } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Explore() {
  const { openSidebar, openComposer } = useOutletContext<MobileShellContext>();
  const { t } = useLanguage();

  return (
    <div className="ios-page">
      <div className="ios-page-header">
        <button
          type="button"
          onClick={openSidebar}
          className="ios-nav-button"
          aria-label={t('common.open_menu')}
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>
        <div className="ios-page-title">{t('explore.title')}</div>
        <div className="ios-header-spacer" />
      </div>

      <div className="ios-panel mt-4">
        <div className="flex items-start gap-3">
          <div className="aurora-home-role-icon inline-flex h-11 w-11 items-center justify-center rounded-2xl border">
            <Compass className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="ios-section-title">{t('explore.discover')}</div>
            <div className="ios-caption mt-1">
              {t('explore.discover_desc')}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="aurora-home-role-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99]"
          onClick={() => openComposer()}
        >
          <Sparkles className="h-4 w-4" />
          {t('explore.ask_question')}
        </button>
      </div>
    </div>
  );
}
