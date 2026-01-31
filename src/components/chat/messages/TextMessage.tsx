import React from 'react';
import { Message } from '@/lib/types';

interface TextMessageProps {
  message: Message;
}

export function TextMessage({ message }: TextMessageProps) {
  return (
    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
      {message.content}
    </p>
  );
}
