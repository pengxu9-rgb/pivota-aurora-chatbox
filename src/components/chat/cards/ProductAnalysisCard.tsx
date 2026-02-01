import React from 'react';
import { Language, ProductAnalysisResult, MechanismVector } from '@/lib/types';
import { t } from '@/lib/i18n';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sun, 
  Moon, 
  Clock,
  Sparkles,
  DollarSign,
  ShieldCheck,
  Droplets,
  Zap,
  Heart,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductVectorRadar, type ProductVector, type ProductVectorAxis, type ProductVectorContributors } from '@/components/aurora/charts/ProductVectorRadar';

const AXES: ProductVectorAxis[] = ['Hydration', 'Anti-Aging', 'Acne Control', 'Brightening', 'Value'];

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getMechanismStrength(result: ProductAnalysisResult, vector: MechanismVector) {
  return clampPercent(result.mechanisms.find((m) => m.vector === vector)?.strength ?? 0);
}

function computeValueScore(result: ProductAnalysisResult) {
  const savings = clampPercent(result.dupeRecommendation?.savingsPercent ?? 0);
  let base = result.dupeRecommendation ? 65 + savings / 2 : 55;
  if (result.suitability === 'poor') base -= 18;
  if (result.suitability === 'moderate') base -= 8;
  return clampPercent(base);
}

function computeProductVector(result: ProductAnalysisResult): ProductVector {
  return {
    Hydration: getMechanismStrength(result, 'hydrating') || 50,
    'Anti-Aging': getMechanismStrength(result, 'anti_aging') || 50,
    'Acne Control': getMechanismStrength(result, 'oil_control') || 50,
    Brightening: getMechanismStrength(result, 'brightening') || 50,
    Value: computeValueScore(result),
  };
}

function computeIdealVector(result: ProductAnalysisResult): ProductVector {
  const base: ProductVector = { Hydration: 65, 'Anti-Aging': 65, 'Acne Control': 65, Brightening: 65, Value: 65 };
  const profile = result.skinProfileMatch;
  if (!profile) return base;

  if (profile.skinType === 'dry') base.Hydration = 85;
  if (profile.skinType === 'oily') base['Acne Control'] = 85;
  if (profile.skinType === 'combination') base['Acne Control'] = 75;
  if (profile.skinType === 'sensitive') {
    base.Hydration = 78;
    base.Value = 78;
  }

  for (const c of profile.matchedConcerns ?? []) {
    switch (c) {
      case 'acne':
        base['Acne Control'] = Math.max(base['Acne Control'], 90);
        break;
      case 'pores':
        base['Acne Control'] = Math.max(base['Acne Control'], 82);
        break;
      case 'dark_spots':
        base.Brightening = Math.max(base.Brightening, 88);
        break;
      case 'dullness':
        base.Brightening = Math.max(base.Brightening, 82);
        break;
      case 'wrinkles':
        base['Anti-Aging'] = Math.max(base['Anti-Aging'], 88);
        break;
      case 'dehydration':
        base.Hydration = Math.max(base.Hydration, 90);
        break;
      case 'redness':
        base.Hydration = Math.max(base.Hydration, 78);
        base.Value = Math.max(base.Value, 72);
        break;
    }
  }

  for (const axis of AXES) base[axis] = clampPercent(base[axis]);
  return base;
}

function pickContributors(axis: ProductVectorAxis, ingredients: string[]) {
  if (axis === 'Value') return [];

  const keywords: Record<ProductVectorAxis, string[]> = {
    Hydration: ['hyalur', 'glycer', 'ceramide', 'panthenol', 'betaine', 'squalane', 'urea', 'allantoin'],
    'Anti-Aging': ['retinol', 'retinal', 'tretinoin', 'peptide', 'bakuchiol', 'vitamin c', 'ascorb', 'copper', 'resveratrol'],
    'Acne Control': ['salicy', 'bha', 'benzoyl', 'azelaic', 'niacin', 'zinc', 'adapal', 'tea tree'],
    Brightening: ['vitamin c', 'ascorb', 'niacin', 'tranex', 'arbutin', 'kojic', 'licorice', 'alpha arbutin'],
    Value: [],
  };

  const lowered = ingredients.map((i) => ({ raw: i, v: i.toLowerCase() }));
  const hits = keywords[axis].length ? lowered.filter((i) => keywords[axis].some((k) => i.v.includes(k))) : [];
  const ordered = [...hits.map((h) => h.raw), ...ingredients];
  return [...new Set(ordered)].slice(0, 3);
}

interface ProductAnalysisCardProps {
  result: ProductAnalysisResult;
  photoPreview?: string;
  language: Language;
  onAction: (actionId: string, data?: Record<string, any>) => void;
}

const mechanismLabels: Record<MechanismVector, { en: string; cn: string; icon: React.ReactNode }> = {
  oil_control: { en: 'Oil Control', cn: '控油', icon: <Droplets className="w-3 h-3" /> },
  soothing: { en: 'Soothing', cn: '舒缓', icon: <Heart className="w-3 h-3" /> },
  repair: { en: 'Repair', cn: '修复', icon: <ShieldCheck className="w-3 h-3" /> },
  brightening: { en: 'Brightening', cn: '提亮', icon: <Sparkles className="w-3 h-3" /> },
  anti_aging: { en: 'Anti-Aging', cn: '抗老', icon: <Zap className="w-3 h-3" /> },
  hydrating: { en: 'Hydrating', cn: '保湿', icon: <Droplets className="w-3 h-3" /> },
};

const suitabilityConfig = {
  excellent: { 
    color: 'text-emerald-600', 
    bg: 'bg-emerald-50', 
    border: 'border-emerald-200',
    icon: CheckCircle2,
    label: { en: 'Excellent Match', cn: '非常适合' }
  },
  good: { 
    color: 'text-blue-600', 
    bg: 'bg-blue-50', 
    border: 'border-blue-200',
    icon: CheckCircle2,
    label: { en: 'Good Match', cn: '适合' }
  },
  moderate: { 
    color: 'text-amber-600', 
    bg: 'bg-amber-50', 
    border: 'border-amber-200',
    icon: AlertTriangle,
    label: { en: 'Use with Caution', cn: '谨慎使用' }
  },
  poor: { 
    color: 'text-rose-600', 
    bg: 'bg-rose-50', 
    border: 'border-rose-200',
    icon: XCircle,
    label: { en: 'Not Recommended', cn: '不建议使用' }
  },
};

export function ProductAnalysisCard({ result, photoPreview, language, onAction }: ProductAnalysisCardProps) {
  const config = suitabilityConfig[result.suitability];
  const SuitabilityIcon = config.icon;
  const productVector = computeProductVector(result);
  const idealVector = computeIdealVector(result);
  const contributors: ProductVectorContributors = AXES.reduce((acc, axis) => {
    acc[axis] = pickContributors(axis, result.ingredients.beneficial ?? []);
    return acc;
  }, {} as ProductVectorContributors);
  
  return (
    <div className="chat-card space-y-4">
      {/* Header with photo and product info */}
      <div className="flex gap-4">
        {photoPreview && (
          <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-border">
            <img src={photoPreview} alt="Product" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{result.productName}</h3>
          <p className="text-sm text-muted-foreground">{result.brand}</p>
          
          {/* Match score ring */}
          <div className="mt-2 flex items-center gap-3">
            <div className={cn(
              "relative w-12 h-12 rounded-full flex items-center justify-center",
              config.bg, config.border, "border-2"
            )}>
              <span className={cn("text-sm font-bold", config.color)}>
                {result.matchScore}
              </span>
            </div>
            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", config.bg, config.color)}>
              <SuitabilityIcon className="w-3.5 h-3.5" />
              {language === 'EN' ? config.label.en : config.label.cn}
            </div>
          </div>
        </div>
      </div>
      
      {/* Skin Profile Match Banner */}
      {result.skinProfileMatch && (
        <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
              <Palette className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-indigo-700">
              {language === 'EN' 
                ? `Matched to your ${result.skinProfileMatch.skinType} skin profile`
                : `基于您的${result.skinProfileMatch.skinType === 'oily' ? '油性' : result.skinProfileMatch.skinType === 'dry' ? '干性' : result.skinProfileMatch.skinType === 'combination' ? '混合性' : result.skinProfileMatch.skinType === 'sensitive' ? '敏感性' : '中性'}肤质分析`
              }
            </span>
          </div>
          {result.skinProfileMatch.matchedConcerns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-indigo-600">
                {language === 'EN' ? 'Addresses:' : '针对:'}
              </span>
              {result.skinProfileMatch.matchedConcerns.map(concern => (
                <span key={concern} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  {concern.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
          {result.skinProfileMatch.unmatchedConcerns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-slate-500">
                {language === 'EN' ? 'Does not address:' : '未涉及:'}
              </span>
              {result.skinProfileMatch.unmatchedConcerns.map(concern => (
                <span key={concern} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {concern.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* VETO Banner */}
      {result.ingredients.veto && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200">
          <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-rose-700">
              {language === 'EN' ? 'VETO: Not suitable for your skin' : 'VETO: 不适合您的肤质'}
            </p>
            <p className="text-xs text-rose-600 mt-0.5">
              {result.ingredients.veto}
            </p>
          </div>
        </div>
      )}

      {/* Product Vector Radar */}
      <ProductVectorRadar
        title={language === 'EN' ? 'Product Vector Radar' : '产品向量雷达'}
        productLabel={language === 'EN' ? 'Product' : '产品'}
        idealLabel={language === 'EN' ? 'Your Ideal' : '你的理想'}
        productVector={productVector}
        idealVector={idealVector}
        contributors={contributors}
        matchScore={result.matchScore}
      />
      
      {/* Mechanism Vectors */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {language === 'EN' ? 'Mechanism Vectors' : '功效向量'}
        </h4>
        <div className="space-y-2">
          {result.mechanisms.map(({ vector, strength }) => {
            const mech = mechanismLabels[vector];
            return (
              <div key={vector} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 w-24 text-xs text-muted-foreground">
                  {mech.icon}
                  <span>{language === 'EN' ? mech.en : mech.cn}</span>
                </div>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${strength}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8 text-right">{strength}%</span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Ingredients */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {language === 'EN' ? 'Beneficial' : '有益成分'}
          </h4>
          <div className="flex flex-wrap gap-1">
            {result.ingredients.beneficial.map(ing => (
              <span key={ing} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {ing}
              </span>
            ))}
          </div>
        </div>
        {result.ingredients.caution.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-medium text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {language === 'EN' ? 'Caution' : '注意成分'}
            </h4>
            <div className="flex flex-wrap gap-1">
              {result.ingredients.caution.map(ing => (
                <span key={ing} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                  {ing}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Usage Advice */}
      <div className="p-3 rounded-xl bg-muted/50 space-y-2">
        <div className="flex items-center gap-2">
          {result.usageAdvice.timing === 'AM' && <Sun className="w-4 h-4 text-amber-500" />}
          {result.usageAdvice.timing === 'PM' && <Moon className="w-4 h-4 text-indigo-500" />}
          {result.usageAdvice.timing === 'both' && (
            <>
              <Sun className="w-4 h-4 text-amber-500" />
              <Moon className="w-4 h-4 text-indigo-500" />
            </>
          )}
          <span className="text-sm font-medium">
            {result.usageAdvice.timing === 'AM' 
              ? (language === 'EN' ? 'Morning Use' : '早间使用')
              : result.usageAdvice.timing === 'PM'
                ? (language === 'EN' ? 'Evening Use' : '晚间使用')
                : (language === 'EN' ? 'Morning & Evening' : '早晚可用')
            }
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{result.usageAdvice.notes}</p>
      </div>
      
      {/* Dupe Recommendation */}
      {result.dupeRecommendation && (
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-primary flex items-center gap-1.5">
              <DollarSign className="w-4 h-4" />
              {language === 'EN' ? 'Budget Alternative' : '平价替代'}
            </h4>
            <span className="text-xs font-bold text-primary">
              {language === 'EN' ? `Save ${result.dupeRecommendation.savingsPercent}%` : `省 ${result.dupeRecommendation.savingsPercent}%`}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium">{result.dupeRecommendation.name}</p>
            <p className="text-xs text-muted-foreground">{result.dupeRecommendation.brand}</p>
            <p className="text-xs text-muted-foreground mt-1">{result.dupeRecommendation.reason}</p>
          </div>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => onAction('product_analysis_done')}
          className="action-button action-button-primary flex-1"
        >
          {language === 'EN' ? 'Done' : '完成'}
        </button>
        <button
          onClick={() => onAction('product_analysis_another')}
          className="action-button action-button-secondary flex-1"
        >
          {language === 'EN' ? 'Analyze Another' : '分析另一个'}
        </button>
      </div>
    </div>
  );
}
