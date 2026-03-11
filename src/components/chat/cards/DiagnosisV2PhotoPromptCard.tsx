import React from 'react';
import type { DiagnosisV2PhotoPromptPayload, Language } from '@/lib/types';
import { t } from '@/lib/i18n';

interface Props {
  payload: DiagnosisV2PhotoPromptPayload;
  language: Language;
  onAction: (actionId: string, data?: Record<string, any>) => void;
}

export function DiagnosisV2PhotoPromptCard({ payload, language, onAction }: Props) {
  if (payload.has_existing_artifact) {
    return (
      <div className="chat-card animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 dark:bg-green-950/30">
          <svg className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-green-700 dark:text-green-300">
            {language === 'CN' ? '已使用你之前的照片数据' : 'Using your previous photo'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-card space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/30">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {language === 'CN' ? '拍照提升准确度' : 'Photo for better accuracy'}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{payload.prompt_text}</p>
          <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-[11px] text-foreground">
            <div className="font-medium">{t('s3.one_photo_hint', language)}</div>
            <div className="mt-0.5 text-muted-foreground">{t('s3.tip', language)}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAction('take_photo', {})}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {payload.photo_action.label}
        </button>
        <button
          type="button"
          onClick={() => onAction('skip_photo', {})}
          className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
        >
          {payload.skip_action.label}
        </button>
      </div>
    </div>
  );
}
