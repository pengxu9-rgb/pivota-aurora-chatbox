import React, { useState } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { Globe, Sparkles } from 'lucide-react';
import { AuroraLogicDrawer } from './AuroraLogicDrawer';

export function AuroraHeader() {
  const { language, setLanguage, session } = useChatContext();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Only show logic button when diagnosis flow is active
  const isDiagnosisActive = session.state !== 'S0_LANDING' && session.state !== 'S1_OPEN_INTENT';

  return (
    <>
      <header className="chat-header">
        <div className="flex items-center gap-3">
          {/* Aurora Logo - enhanced glass effect */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
            <span className="text-white font-bold text-lg relative z-10 drop-shadow-sm">A</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground tracking-tight">
              Aurora
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              {language === 'EN' ? 'Beauty Consultant' : '美容顾问'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Logic Drawer Toggle - enhanced with icon container */}
          {isDiagnosisActive && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 text-primary text-sm font-medium transition-all hover:from-primary/15 hover:to-primary/10 hover:shadow-sm border border-primary/10"
            >
              <div className="w-5 h-5 rounded-lg icon-container flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="hidden sm:inline">
                {language === 'EN' ? 'Logic' : '逻辑'}
              </span>
            </button>
          )}
          
          {/* Language Toggle - enhanced */}
          <button
            onClick={() => setLanguage(language === 'EN' ? 'CN' : 'EN')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/80 text-muted-foreground text-sm font-medium transition-all hover:bg-muted hover:text-foreground border border-border/30 hover:border-border/50"
          >
            <Globe className="w-4 h-4" />
            <span className="font-semibold">{language}</span>
          </button>
        </div>
      </header>
      
      {/* Logic Drawer - only render when diagnosis is active */}
      {isDiagnosisActive && (
        <AuroraLogicDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          currentState={session.state}
          language={language}
        />
      )}
    </>
  );
}
