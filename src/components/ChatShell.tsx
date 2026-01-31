import React from 'react';
import { ChatProvider, useChatContext } from '@/contexts/ChatContext';
import { AuroraHeader } from './aurora/AuroraHeader';
import { MessageList } from './chat/MessageList';
import { ChatInput } from './chat/ChatInput';
import { AuroraFloatingProgress } from './aurora/cards/AuroraFloatingProgress';

function ChatContent() {
  const { session, language } = useChatContext();
  
  return (
    <div className="chat-container">
      <AuroraHeader />
      <MessageList />
      <AuroraFloatingProgress 
        currentState={session.state}
        language={language}
        isActive={session.isDiagnosisActive || false}
      />
      <ChatInput />
    </div>
  );
}

export function ChatShell() {
  return (
    <ChatProvider>
      <ChatContent />
    </ChatProvider>
  );
}
