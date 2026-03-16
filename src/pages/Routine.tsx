import React from 'react';
import { Beaker, Menu, Sparkles } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

import type { MobileShellContext } from '@/layouts/MobileShell';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Routine() {
  const { openSidebar, startChat } = useOutletContext<MobileShellContext>();
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
        <div className="ios-page-title">{t('routine.title')}</div>
        <div className="ios-header-spacer" />
      </div>

      <div className="ios-panel mt-4">
        <div className="ios-section-title">{t('routine.build')}</div>
        <div className="ios-caption mt-1">{t('routine.build_desc')}</div>

        <button
          type="button"
          className="aurora-home-role-primary mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[14px] font-semibold shadow-card active:scale-[0.99]"
          onClick={() => startChat({ kind: 'chip', title: t('composer.action.routine_builder'), chip_id: 'chip.start.routine' })}
        >
          <Beaker className="h-4 w-4" />
          {t('routine.start_builder')}
        </button>
      </div>

      <div className="ios-panel-soft mt-3">
        <div className="ios-section-title">{t('routine.get_reco')}</div>
        <div className="ios-caption mt-1">{t('routine.get_reco_desc')}</div>
        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-2.5 text-[14px] font-semibold text-foreground shadow-card active:scale-[0.99]"
          onClick={() => startChat({ kind: 'chip', title: t('routine.get_reco'), chip_id: 'chip.start.reco_products' })}
        >
          <Sparkles className="h-4 w-4" />
          {t('routine.ask_reco')}
        </button>
      </div>
    </div>
  );
}
