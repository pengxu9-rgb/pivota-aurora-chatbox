import React from 'react';
import { Language, Product, Offer } from '@/lib/types';
import { ExternalLink, CheckCircle, AlertTriangle, Bookmark, ArrowRight } from 'lucide-react';

interface AffiliateOutcomeCardProps {
  affiliateItems: { product: Product; offer: Offer }[];
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

export function AffiliateOutcomeCard({ affiliateItems, onAction, language }: AffiliateOutcomeCardProps) {
  return (
    <div className="chat-card-elevated space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 pb-3 border-b border-border/50">
        <div className="w-11 h-11 rounded-xl icon-container flex items-center justify-center flex-shrink-0">
          <ExternalLink className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="section-label">
            {language === 'EN' ? 'EXTERNAL PURCHASE' : '外部购买'}
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            {language === 'EN' 
              ? 'Complete your purchase on retailer sites' 
              : '在零售商网站完成购买'
            }
          </h3>
        </div>
      </div>

      {/* Disclosure */}
      <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
        <p className="text-xs text-muted-foreground">
          {language === 'EN'
            ? '📌 These links open retailer websites. Affiliate links are used—no price change for you.'
            : '📌 这些链接将打开零售商网站。使用联盟链接——您的价格不变。'
          }
        </p>
      </div>

      {/* Affiliate items list */}
      <div className="space-y-2">
        {affiliateItems.map(({ product, offer }) => (
          <a
            key={offer.offer_id}
            href={offer.affiliate_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/30 hover:bg-muted/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{product.brand}</p>
                <p className="text-xs text-muted-foreground">{product.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {offer.currency === 'GBP' ? '£' : offer.currency === 'EUR' ? '€' : '$'}
                {offer.price.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">{offer.seller}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </a>
        ))}
      </div>

      {/* Outcome closure */}
      <div className="pt-3 border-t border-border/50">
        <p className="text-sm text-muted-foreground mb-3">
          {language === 'EN' 
            ? 'After visiting the retailer sites:' 
            : '访问零售商网站后：'
          }
        </p>
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => onAction('affiliate_outcome_success')}
            className="action-button action-button-primary flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {language === 'EN' ? "✅ I completed my purchase" : "✅ 我已完成购买"}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onAction('affiliate_outcome_failed')}
              className="action-button action-button-secondary flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {language === 'EN' ? "Couldn't complete" : "无法完成"}
            </button>
            <button
              onClick={() => onAction('affiliate_outcome_save')}
              className="action-button action-button-ghost flex items-center justify-center gap-2"
            >
              <Bookmark className="w-4 h-4" />
              {language === 'EN' ? "Save routine" : "保存方案"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
