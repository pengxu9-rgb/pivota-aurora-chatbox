import React, { useState } from 'react';
import { Language, Product, Offer } from '@/lib/types';
import { AlertOctagon, TrendingDown, Beaker, Star, AlertTriangle } from 'lucide-react';

interface AuroraAnchorCardProps {
  product: Product;
  offers: Offer[];
  vetoReason?: string;
  mechanismVector?: {
    oilControl: number;
    soothing: number;
    repair: number;
    brightening: number;
  };
  language: Language;
  onSelect?: () => void;
}

export function AuroraAnchorCard({ 
  product, 
  offers, 
  vetoReason, 
  mechanismVector,
  language,
  onSelect 
}: AuroraAnchorCardProps) {
  const bestOffer = offers[0];
  
  const vector = mechanismVector || null;
  const hasVector =
    vector != null &&
    typeof vector.oilControl === 'number' &&
    typeof vector.soothing === 'number' &&
    typeof vector.repair === 'number' &&
    typeof vector.brightening === 'number';

  const vectorLabels = {
    oilControl: { EN: 'Oil Control', CN: '控油' },
    soothing: { EN: 'Soothing', CN: '舒缓' },
    repair: { EN: 'Repair', CN: '修复' },
    brightening: { EN: 'Brightening', CN: '提亮' },
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${
      vetoReason ? 'border-risk/50' : 'border-border'
    }`}>
      {/* VETO Banner */}
      {vetoReason && (
        <div className="veto-banner">
          <AlertOctagon className="w-4 h-4" />
          <span>VETO: {vetoReason}</span>
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Product Header */}
        <div className="flex gap-3">
          <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
            {product.image_url ? (
              <img 
                src={product.image_url} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-muted-foreground">
                {(product.brand || product.name || 'P').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {product.category}
            </p>
            <p className="text-sm font-semibold text-foreground truncate">
              {product.brand}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {product.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-base font-bold text-foreground font-mono-nums">
                {typeof bestOffer?.price === 'number' && Number.isFinite(bestOffer.price)
                  ? `$${bestOffer.price.toFixed(2)}`
                  : language === 'EN'
                    ? 'Price unknown'
                    : '价格未知'}
              </span>
              {bestOffer?.original_price && (
                <span className="text-xs text-muted-foreground line-through font-mono-nums">
                  ${bestOffer.original_price.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mechanism Vector */}
        {hasVector ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Beaker className="w-3 h-3 text-primary" />
              <span className="section-label">
                {language === 'EN' ? 'MECHANISM VECTOR' : '机制向量'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(vector).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {vectorLabels[key as keyof typeof vectorLabels][language]}
                      </span>
                      <span className="text-[10px] font-mono-nums text-foreground">
                        {value}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          value >= 70 ? 'bg-success' : value >= 40 ? 'bg-warning' : 'bg-muted-foreground'
                        }`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Risk Flags */}
        {vetoReason && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-risk/10">
            <AlertTriangle className="w-4 h-4 text-risk flex-shrink-0 mt-0.5" />
            <p className="text-xs text-risk">
              {language === 'EN' 
                ? 'Not recommended for sensitive/reactive skin. May cause increased irritation.'
                : '不推荐敏感/反应性肌肤使用。可能加重刺激。'
              }
            </p>
          </div>
        )}

        {/* Offer Badges */}
        {bestOffer && bestOffer.badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bestOffer.badges.map((badge) => (
              <span 
                key={badge}
                className={`offer-badge ${
                  badge === 'best_price' ? 'offer-badge-best-price' :
                  badge === 'best_returns' ? 'offer-badge-best-returns' :
                  badge === 'fastest_shipping' ? 'offer-badge-fastest' :
                  'offer-badge-reliable'
                }`}
              >
                {badge === 'best_price' && '💰'}
                {badge === 'best_returns' && '↩️'}
                {badge === 'fastest_shipping' && '⚡'}
                {badge === 'high_reliability' && '⭐'}
                {' '}
                {language === 'EN' 
                  ? badge.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                  : badge === 'best_price' ? '最低价' :
                    badge === 'best_returns' ? '退换保障' :
                    badge === 'fastest_shipping' ? '最快发货' : '高可靠'
                }
              </span>
            ))}
          </div>
        )}

        {onSelect && (
          <button
            onClick={onSelect}
            className="action-button action-button-primary w-full"
          >
            {language === 'EN' ? 'Select This Product' : '选择此产品'}
          </button>
        )}
      </div>
    </div>
  );
}
