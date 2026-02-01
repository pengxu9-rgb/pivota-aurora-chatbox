import React, { useRef, useEffect, useState } from 'react';
import { useChatContext } from '@/contexts/ChatContext';
import { Message } from '@/lib/types';
import { TextMessage } from './messages/TextMessage';
import { ChipsMessage } from './messages/ChipsMessage';
import { ContextCard } from './cards/ContextCard';
import { PhotoUploadCard } from './cards/PhotoUploadCard';
import { RiskCheckCard } from './cards/RiskCheckCard';
import { RoutineCard } from './cards/RoutineCard';
import { SuccessCard } from './cards/SuccessCard';
import { FailureCard } from './cards/FailureCard';
import { ProductAnalysisCard } from './cards/ProductAnalysisCard';
import { AffiliateOutcomeCard } from './cards/AffiliateOutcomeCard';

// Aurora Cards
import { AuroraProfileCard } from '../aurora/cards/AuroraProfileCard';
import { AuroraScoringCard } from '../aurora/cards/AuroraScoringCard';
import { AuroraDupeCard } from '../aurora/cards/AuroraDupeCard';
import { AuroraBudgetCard } from '../aurora/cards/AuroraBudgetCard';
import { AuroraLoadingCard } from '../aurora/cards/AuroraLoadingCard';
import { AuroraDiagnosisProgress } from '../aurora/cards/AuroraDiagnosisProgress';
import { AuroraLogicDrawer } from '../aurora/AuroraLogicDrawer';
import { SkinIdentityCard } from '../aurora/cards/SkinIdentityCard';

function MessageBubble({ message }: { message: Message }) {
  const { handleAction, language, session } = useChatContext();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const renderContent = () => {
    switch (message.type) {
      case 'text':
        return <TextMessage message={message} />;
      case 'chips':
        return <ChipsMessage payload={message.payload} onAction={handleAction} />;
      case 'context_card':
        return <ContextCard onAction={handleAction} language={language} />;
      case 'diagnosis_card':
        return <AuroraProfileCard onAction={handleAction} language={language} />;
      case 'diagnosis_progress':
        return (
          <>
            <AuroraDiagnosisProgress 
              currentState={session.state} 
              language={language} 
              onExpand={() => setIsDrawerOpen(true)}
            />
            <AuroraLogicDrawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              currentState={session.state}
              language={language}
            />
          </>
        );
      case 'skin_identity_card':
        return <SkinIdentityCard payload={message.payload} onAction={handleAction} language={language} />;
      case 'budget_card':
        return <AuroraBudgetCard onAction={handleAction} language={language} />;
      case 'photo_upload_card':
        return <PhotoUploadCard onAction={handleAction} language={language} />;
      case 'loading_card':
        return (
          <AuroraLoadingCard
            onSkip={session.state === 'S4_ANALYSIS_LOADING' ? () => handleAction('analysis_skip') : undefined}
            language={language}
          />
        );
      case 'analysis_summary':
        return <AuroraScoringCard payload={message.payload} onAction={handleAction} language={language} />;
      case 'risk_check_card':
        return <RiskCheckCard onAction={handleAction} language={language} />;
      case 'routine_card':
        return <RoutineCard payload={message.payload} onAction={handleAction} language={language} />;
      case 'product_comparison_card':
        return <AuroraDupeCard payload={message.payload} onAction={handleAction} language={language} />;
      case 'success_card':
        return <SuccessCard payload={message.payload} onAction={handleAction} language={language} />;
      case 'failure_card':
        return <FailureCard payload={message.payload} onAction={handleAction} language={language} />;
      case 'product_analysis_card':
        return (
          <ProductAnalysisCard 
            result={message.payload.result}
            photoPreview={message.payload.photoPreview}
            language={language}
            onAction={handleAction}
          />
        );
      case 'affiliate_outcome_card':
        return (
          <AffiliateOutcomeCard
            affiliateItems={message.payload.affiliateItems}
            onAction={handleAction}
            language={language}
          />
        );
      default:
        return null;
    }
  };

  const isCard = message.type !== 'text';
  const isUser = message.role === 'user';

  if (isCard) {
    return (
      <div className="w-full animate-fade-in">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={isUser ? 'message-bubble-user' : 'message-bubble-assistant'}>
        {renderContent()}
      </div>
    </div>
  );
}

export function MessageList() {
  const { messages } = useChatContext();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-messages scrollbar-hide">
      <div className="max-w-lg mx-auto space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
