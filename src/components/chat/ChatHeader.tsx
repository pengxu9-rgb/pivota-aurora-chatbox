import React from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { t } from '@/lib/i18n';
import { Globe } from 'lucide-react';

export function ChatHeader() {
  const { language, setLanguage, session } = useChatContext();

  return (
    <header className="chat-header">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">
          {t('header.title', language)}
        </h1>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gradient-to-r from-primary/15 to-primary/10 text-primary border border-primary/20">
          {session.mode === 'demo' 
            ? t('header.demo_mode', language) 
            : t('header.live_mode', language)}
        </span>
      </div>
      
      <button
        onClick={() => setLanguage(language === 'EN' ? 'CN' : 'EN')}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/80 text-muted-foreground text-sm font-medium transition-all hover:bg-muted hover:text-foreground border border-border/30 hover:border-border/50"
      >
        <Globe className="w-4 h-4" />
        <span className="font-semibold">{language}</span>
      </button>
    </header>
  );
}
