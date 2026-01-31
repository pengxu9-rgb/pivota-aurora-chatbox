import React from 'react';
import { Language } from '@/lib/types';
import { Sun, Moon, AlertTriangle, Check } from 'lucide-react';

interface RoutineStep {
  category: string;
  product: {
    name: string;
    brand: string;
  };
  type: 'premium' | 'dupe';
}

interface AuroraRoutineCardProps {
  amSteps: RoutineStep[];
  pmSteps: RoutineStep[];
  conflicts?: string[];
  language: Language;
  onAction?: (actionId: string) => void;
}

export function AuroraRoutineCard({ 
  amSteps, 
  pmSteps, 
  conflicts = [],
  language,
  onAction 
}: AuroraRoutineCardProps) {
  const categoryLabels: Record<string, { EN: string; CN: string }> = {
    cleanser: { EN: 'Cleanser', CN: '洁面' },
    treatment: { EN: 'Treatment', CN: '精华' },
    moisturizer: { EN: 'Moisturizer', CN: '保湿' },
    sunscreen: { EN: 'SPF', CN: '防晒' },
  };

  const renderStep = (step: RoutineStep, idx: number) => (
    <div 
      key={idx}
      className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
    >
      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium ${
        step.type === 'premium' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
      }`}>
        {idx + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">
          {step.product.brand}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {step.product.name}
        </p>
      </div>
      <span className={`signal-pill text-[10px] ${
        step.type === 'premium' ? 'signal-pill-warning' : 'signal-pill-success'
      }`}>
        {categoryLabels[step.category]?.[language] || step.category}
      </span>
    </div>
  );

  return (
    <div className="chat-card-elevated space-y-4">
      {/* Header */}
      <div className="pb-3 border-b border-border">
        <p className="section-label mb-1">
          {language === 'EN' ? 'ROUTINE & COMPATIBILITY' : '搭配与禁忌'}
        </p>
        <h3 className="text-sm font-semibold text-foreground">
          {language === 'EN' ? 'Your Personalized Routine' : '你的个性化护肤流程'}
        </h3>
      </div>

      {/* Conflicts Warning */}
      {conflicts.length > 0 && (
        <div className="p-3 rounded-lg bg-risk/10 border border-risk/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-risk" />
            <span className="text-sm font-medium text-risk">
              ⚠️ {language === 'EN' ? 'Conflicts Detected' : '检测到冲突'}
            </span>
          </div>
          <ul className="space-y-1">
            {conflicts.map((conflict, idx) => (
              <li key={idx} className="text-xs text-risk flex items-start gap-1">
                <span>•</span>
                <span>{conflict}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AM Routine */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-warning" />
          <span className="text-sm font-medium text-foreground">
            {language === 'EN' ? 'Morning Routine' : '早间护肤'}
          </span>
          <span className="text-xs text-muted-foreground">
            ({amSteps.length} {language === 'EN' ? 'steps' : '步'})
          </span>
        </div>
        <div className="space-y-1.5">
          {amSteps.map(renderStep)}
        </div>
      </div>

      {/* PM Routine */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {language === 'EN' ? 'Evening Routine' : '晚间护肤'}
          </span>
          <span className="text-xs text-muted-foreground">
            ({pmSteps.length} {language === 'EN' ? 'steps' : '步'})
          </span>
        </div>
        <div className="space-y-1.5">
          {pmSteps.map(renderStep)}
        </div>
      </div>

      {/* Compatibility Check */}
      {conflicts.length === 0 && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2">
          <Check className="w-4 h-4 text-success" />
          <span className="text-sm text-success">
            {language === 'EN' 
              ? 'All products are compatible ✓' 
              : '所有产品均兼容 ✓'
            }
          </span>
        </div>
      )}
    </div>
  );
}
