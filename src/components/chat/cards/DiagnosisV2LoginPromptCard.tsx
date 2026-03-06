import React from 'react';
import type { DiagnosisV2LoginPromptPayload, Language } from '@/lib/types';

interface Props {
  payload: DiagnosisV2LoginPromptPayload;
  language: Language;
  onAction: (actionId: string, data?: Record<string, any>) => void;
}

export function DiagnosisV2LoginPromptCard({ payload, language, onAction }: Props) {
  return (
    <div className="chat-card space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {language === 'CN' ? '登录后诊断更准确' : 'Log in for better diagnosis'}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{payload.prompt_text}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAction('login_then_diagnose', payload.login_action.payload)}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {payload.login_action.label}
        </button>
        <button
          type="button"
          onClick={() => onAction('skip_login', payload.skip_action.payload)}
          className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
        >
          {payload.skip_action.label}
        </button>
      </div>
    </div>
  );
}
