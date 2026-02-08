import React, { useState } from 'react';
import { Language, RoutineSet, Session, RoutineStep, Offer } from '@/lib/types';
import { t, getBadgeLabel } from '@/lib/i18n';
import { Sun, Moon, ShoppingCart, Settings, Bookmark, ChevronDown, ChevronUp, Check } from 'lucide-react';

interface RoutineCardProps {
  payload: {
    routine: RoutineSet;
    session: Session;
  };
  onAction: (actionId: string, data?: Record<string, any>) => void;
  language: Language;
}

function ProductStep({ 
  step, 
  selectedOfferId,
  onSelectOffer,
  language 
}: { 
  step: RoutineStep;
  selectedOfferId?: string;
  onSelectOffer: (skuId: string, offerId: string) => void;
  language: Language;
}) {
  const [showOffers, setShowOffers] = useState(false);
  const selectedOffer = step.offers.find(o => o.offer_id === selectedOfferId) || step.offers[0];

  return (
    <div className="product-card">
      <div className="flex gap-3">
        <img 
          src={step.product.image_url} 
          alt={step.product.name}
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {step.product.category}
          </p>
          <p className="font-medium text-sm text-foreground truncate">
            {step.product.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {step.product.brand} · {step.product.size}
          </p>
          
          {/* Selected offer preview */}
          <div className="flex items-center gap-2 mt-2">
            <span className="font-semibold text-foreground">
              {selectedOffer.currency === 'GBP' ? '£' : selectedOffer.currency === 'EUR' ? '€' : '$'}
              {selectedOffer.price.toFixed(2)}
            </span>
            {selectedOffer.original_price && (
              <span className="text-xs text-muted-foreground line-through">
                {selectedOffer.currency === 'GBP' ? '£' : selectedOffer.currency === 'EUR' ? '€' : '$'}
                {selectedOffer.original_price.toFixed(2)}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              via {selectedOffer.seller}
            </span>
          </div>
          
          {/* Badges */}
          <div className="flex flex-wrap gap-1 mt-1">
            {selectedOffer.badges.map((badge) => (
              <span 
                key={badge} 
                className={`offer-badge ${
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
        </div>
      </div>

      {/* Offer picker toggle */}
      <button
        onClick={() => setShowOffers(!showOffers)}
        className="w-full mt-3 flex items-center justify-between py-2 text-sm text-primary"
      >
        <span>{t('s6.btn.choose_offer', language)}</span>
        {showOffers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Offers list */}
      {showOffers && (
        <div className="mt-2 space-y-2 pt-2 border-t border-border">
          {step.offers.map((offer) => (
            <OfferRow
              key={offer.offer_id}
              offer={offer}
              isSelected={offer.offer_id === selectedOfferId}
              onSelect={() => onSelectOffer(step.product.sku_id, offer.offer_id)}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OfferRow({ 
  offer, 
  isSelected, 
  onSelect,
  language 
}: { 
  offer: Offer;
  isSelected: boolean;
  onSelect: () => void;
  language: Language;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-3 rounded-lg text-left transition-colors ${
        isSelected 
          ? 'bg-primary/10 border border-primary/30' 
          : 'bg-muted/50 border border-transparent hover:bg-muted'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{offer.seller}</span>
            <span className="font-semibold text-foreground">
              {offer.currency === 'GBP' ? '£' : offer.currency === 'EUR' ? '€' : '$'}
              {offer.price.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{t('offer.shipping', language, { days: offer.shipping_days })}</span>
            <span>{offer.returns_policy}</span>
            <span>{offer.reliability_score}% reliable</span>
          </div>
        </div>
        {isSelected && (
          <Check className="w-5 h-5 text-primary flex-shrink-0" />
        )}
      </div>
    </button>
  );
}

export function RoutineCard({ payload, onAction, language }: RoutineCardProps) {
  const { routine, session } = payload;
  const [selectedOffers, setSelectedOffers] = useState<Record<string, string>>(session.selected_offers);

  const handleSelectOffer = (skuId: string, offerId: string) => {
    setSelectedOffers(prev => ({ ...prev, [skuId]: offerId }));
    onAction('select_offer', { sku_id: skuId, offer_id: offerId });
  };

  return (
    <div className="space-y-4">
      {/* Preference chips */}
      <div className="chat-card">
        <p className="text-sm text-muted-foreground mb-3">Adjust your routine:</p>
        <div className="flex flex-wrap gap-2">
          {(['cheaper', 'gentler', 'fastest', 'keep'] as const).map((pref) => (
            <button
              key={pref}
              onClick={() => onAction(pref === 'fastest' ? 'pref_fastest_delivery' : `pref_${pref}`)}
              className={`chip-button ${routine.preference === pref ? 'chip-button-primary' : ''}`}
            >
              {t(`s6.pref.${pref}` as any, language)}
            </button>
          ))}
        </div>
      </div>

      {/* AM Routine */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Sun className="w-4 h-4 text-warning" />
          <span className="font-medium text-sm text-foreground">
            {t('s6.am_label', language)}
          </span>
        </div>
        <div className="space-y-2">
          {routine.am_steps.map((step) => (
            <ProductStep
              key={step.product.sku_id}
              step={step}
              selectedOfferId={selectedOffers[step.product.sku_id]}
              onSelectOffer={handleSelectOffer}
              language={language}
            />
          ))}
        </div>
      </div>

      {/* PM Routine */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Moon className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm text-foreground">
            {t('s6.pm_label', language)}
          </span>
        </div>
        <div className="space-y-2">
          {routine.pm_steps.map((step) => (
            <ProductStep
              key={step.product.sku_id}
              step={step}
              selectedOfferId={selectedOffers[step.product.sku_id]}
              onSelectOffer={handleSelectOffer}
              language={language}
            />
          ))}
        </div>
      </div>

      {/* Total and actions */}
      <div className="chat-card-elevated space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('s6.total_estimate', language, {
              min: routine.total_estimate.min,
              max: routine.total_estimate.max,
              currency: routine.total_estimate.currency,
            })}
          </span>
        </div>

        <button
          onClick={() => onAction('checkout_confirm')}
          className="action-button action-button-primary w-full flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-5 h-5" />
          {t('s6.btn.checkout', language)}
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => onAction('customize')}
            className="action-button action-button-secondary flex-1 flex items-center justify-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {t('s6.btn.customize', language)}
          </button>
          <button
            onClick={() => onAction('save')}
            className="action-button action-button-ghost flex-1 flex items-center justify-center gap-2"
          >
            <Bookmark className="w-4 h-4" />
            {t('s6.btn.save', language)}
          </button>
        </div>
      </div>
    </div>
  );
}
