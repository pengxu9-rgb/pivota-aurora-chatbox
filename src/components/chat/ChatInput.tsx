import React, { useState, useRef } from 'react';
import { Camera, Send } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';

export function ChatInput() {
  const [input, setInput] = useState('');
  const { sendUserText, handleAction, isLoading, language } = useChatContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    void sendUserText(input.trim());
    setInput('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        handleAction('product_photo_upload', { 
          file, 
          preview: event.target?.result as string 
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  // Keep the chat box always available, so users can stay in "chat mode" even during wizard cards.
  // (State should only advance on explicit actions/chips.)

  return (
    <div className="chat-input-container">
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 p-2 bg-card rounded-2xl border border-border/50 shadow-sm">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-muted/60 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200 hover:shadow-sm border border-transparent hover:border-primary/20"
            title={language === 'EN' ? 'Upload a product photo' : '上传产品照片'}
          >
            <Camera className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={language === 'EN' ? 'Ask a question… (or paste a product link)' : '输入问题…（或粘贴产品链接）'}
            className="flex-1 px-3 py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none text-[15px]"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-md disabled:hover:shadow-none"
            style={{ boxShadow: input.trim() ? '0 2px 8px hsl(239 84% 67% / 0.35)' : 'none' }}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
