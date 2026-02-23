import React from 'react';

import type { Language as UiLanguage } from '@/lib/types';

type CardRenderBoundaryProps = {
  children: React.ReactNode;
  language: UiLanguage;
  cardType?: string;
  cardId?: string;
};

type CardRenderBoundaryState = {
  hasError: boolean;
};

export class CardRenderBoundary extends React.Component<CardRenderBoundaryProps, CardRenderBoundaryState> {
  state: CardRenderBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): CardRenderBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Keep the rest of the chat renderable when a single card crashes.
    console.error('[CardRenderBoundary] card render failed', {
      card_type: this.props.cardType || null,
      card_id: this.props.cardId || null,
      error,
    });
  }

  componentDidUpdate(prevProps: CardRenderBoundaryProps) {
    if (!this.state.hasError) return;
    if (prevProps.cardId !== this.props.cardId || prevProps.cardType !== this.props.cardType) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="rounded-2xl border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
        {this.props.language === 'CN'
          ? '此卡片渲染失败，已自动降级。其他结果仍可继续查看。'
          : 'This card failed to render and was safely downgraded. Other results remain available.'}
      </div>
    );
  }
}
