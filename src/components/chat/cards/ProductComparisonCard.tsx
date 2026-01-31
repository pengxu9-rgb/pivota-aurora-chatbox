import React, { useState } from 'react';
import { Language, Product, Offer } from '@/lib/types';
import { t, getBadgeLabel } from '@/lib/i18n';
import { Crown, Sparkles, Check, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';

interface ProductPair {
  category: string;
  premium: {
    product: Product;
    offers: Offer[];
  };
  dupe: {
    product: Product;
    offers: Offer[];
  };
}

interface ProductComparisonCardProps {
  payload: {
    pairs: ProductPair[];
    routine: 'am' | 'pm';
    session: any;
  };
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

function ProductOption({
  product,
  offers,
  type,
  isSelected,
  onSelect,
  onSelectOffer,
  selectedOfferId,
  language,
}: {
  product: Product;
  offers: Offer[];
  type: 'premium' | 'dupe';
  isSelected: boolean;
  onSelect: () => void;
  onSelectOffer: (offerId: string) => void;
  selectedOfferId?: string;
  language: Language;
}) {
  const [showOffers, setShowOffers] = useState(false);
  const bestOffer = offers.reduce((best, o) => (o.price < best.price ? o : best), offers[0]);
  const selectedOffer = offers.find(o => o.offer_id === selectedOfferId) || bestOffer;

  return (
    <div
      className={`flex-1 p-3 rounded-xl border-2 transition-all cursor-pointer ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/30'
      }`}
      onClick={onSelect}
    >
      {/* Type badge */}
      <div className="flex items-center gap-1.5 mb-2">
        {type === 'premium' ? (
          <>
            <Crown className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-medium text-warning">
              {t('product.premium', language)}
            </span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-success" />
            <span className="text-xs font-medium text-success">
              {t('product.dupe', language)}
            </span>
          </>
        )}
        {isSelected && (
          <Check className="w-3.5 h-3.5 text-primary ml-auto" />
        )}
      </div>

      {/* Product info */}
      <div className="flex gap-2">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-xs text-foreground leading-tight line-clamp-2">
            {product.name}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {product.brand}
          </p>
        </div>
      </div>

      {/* Price */}
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-semibold text-foreground">
          ${selectedOffer.price.toFixed(2)}
        </span>
        <span className="text-xs text-muted-foreground">
          via {selectedOffer.seller}
        </span>
      </div>

      {/* Offer badges */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {selectedOffer.badges.slice(0, 2).map((badge) => (
          <span
            key={badge}
            className={`offer-badge text-[10px] ${
              badge === 'best_price' ? 'offer-badge-best-price' :
              badge === 'best_returns' ? 'offer-badge-best-returns' :
              badge === 'fastest_shipping' ? 'offer-badge-fastest' :
              'offer-badge-reliable'
            }`}
          >
            {getBadgeLabel(badge, language)}
          </span>
        ))}
      </div>

      {/* Offer picker toggle */}
      {isSelected && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowOffers(!showOffers);
            }}
            className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 text-xs text-primary"
          >
            <span>{t('product.compare_sellers', language)}</span>
            {showOffers ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showOffers && (
            <div className="mt-1 space-y-1.5 pt-2 border-t border-border">
              {offers.map((offer) => (
                <button
                  key={offer.offer_id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectOffer(offer.offer_id);
                  }}
                  className={`w-full p-2 rounded-lg text-left text-xs transition-colors ${
                    offer.offer_id === selectedOfferId
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-muted/50 border border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{offer.seller}</span>
                    <span className="font-semibold">${offer.price.toFixed(2)}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {offer.shipping_days}d shipping · {offer.reliability_score}% reliable
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductPairCard({
  pair,
  selections,
  onSelect,
  onSelectOffer,
  language,
}: {
  pair: ProductPair;
  selections: Record<string, { type: 'premium' | 'dupe'; offerId?: string }>;
  onSelect: (category: string, type: 'premium' | 'dupe') => void;
  onSelectOffer: (category: string, offerId: string) => void;
  language: Language;
}) {
  const selection = selections[pair.category] || { type: 'dupe' };

  return (
    <div className="chat-card space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {t(`product.category.${pair.category}`, language)}
      </p>
      <div className="flex gap-2">
        <ProductOption
          product={pair.premium.product}
          offers={pair.premium.offers}
          type="premium"
          isSelected={selection.type === 'premium'}
          onSelect={() => onSelect(pair.category, 'premium')}
          onSelectOffer={(offerId) => onSelectOffer(pair.category, offerId)}
          selectedOfferId={selection.type === 'premium' ? selection.offerId : undefined}
          language={language}
        />
        <ProductOption
          product={pair.dupe.product}
          offers={pair.dupe.offers}
          type="dupe"
          isSelected={selection.type === 'dupe'}
          onSelect={() => onSelect(pair.category, 'dupe')}
          onSelectOffer={(offerId) => onSelectOffer(pair.category, offerId)}
          selectedOfferId={selection.type === 'dupe' ? selection.offerId : undefined}
          language={language}
        />
      </div>
    </div>
  );
}

export function ProductComparisonCard({ payload, onAction, language }: ProductComparisonCardProps) {
  const { pairs, routine } = payload;
  const [selections, setSelections] = useState<Record<string, { type: 'premium' | 'dupe'; offerId?: string }>>(() => {
    const initial: Record<string, { type: 'premium' | 'dupe'; offerId?: string }> = {};
    pairs.forEach(pair => {
      initial[pair.category] = { 
        type: 'dupe',
        offerId: pair.dupe.offers[0]?.offer_id
      };
    });
    return initial;
  });

  const handleSelect = (category: string, type: 'premium' | 'dupe') => {
    const pair = pairs.find(p => p.category === category);
    if (!pair) return;
    const offers = type === 'premium' ? pair.premium.offers : pair.dupe.offers;
    setSelections(prev => ({
      ...prev,
      [category]: { type, offerId: offers[0]?.offer_id }
    }));
  };

  const handleSelectOffer = (category: string, offerId: string) => {
    setSelections(prev => ({
      ...prev,
      [category]: { ...prev[category], offerId }
    }));
  };

  const calculateTotal = () => {
    let total = 0;
    pairs.forEach(pair => {
      const selection = selections[pair.category];
      if (!selection) return;
      const productData = selection.type === 'premium' ? pair.premium : pair.dupe;
      const offer = productData.offers.find(o => o.offer_id === selection.offerId) || productData.offers[0];
      total += offer?.price || 0;
    });
    return total.toFixed(2);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="text-lg">{routine === 'am' ? '☀️' : '🌙'}</span>
        <span className="font-medium text-sm text-foreground">
          {t(routine === 'am' ? 's6.am_label' : 's6.pm_label', language)}
        </span>
      </div>

      {pairs.map((pair) => (
        <ProductPairCard
          key={pair.category}
          pair={pair}
          selections={selections}
          onSelect={handleSelect}
          onSelectOffer={handleSelectOffer}
          language={language}
        />
      ))}

      <div className="chat-card-elevated space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('product.total', language)}
          </span>
          <span className="font-semibold text-lg text-foreground">
            ${calculateTotal()}
          </span>
        </div>
        
        <button
          onClick={() => onAction('checkout_confirm', { selections, routine })}
          className="action-button action-button-primary w-full flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-5 h-5" />
          {t('s6.btn.checkout', language)}
        </button>
      </div>
    </div>
  );
}
