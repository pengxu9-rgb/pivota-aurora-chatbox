import React from 'react';
import { FlowState, Language } from '@/lib/types';
import { Terminal, Box, Calculator, GitCompareArrows, Wallet, CheckCircle2 } from 'lucide-react';

interface AuroraStepIndicatorProps {
  currentState: FlowState;
  language: Language;
}

interface Step {
  id: string;
  icon: React.ElementType;
  label: { EN: string; CN: string };
  states: FlowState[];
}

const STEPS: Step[] = [
  {
    id: 'input',
    icon: Terminal,
    label: { EN: 'Input', CN: '输入' },
    states: ['S0_LANDING', 'S1_OPEN_INTENT', 'S2_DIAGNOSIS', 'S3_PHOTO_OPTION', 'S3a_PHOTO_QC'],
  },
  {
    id: 'analyze',
    icon: Box,
    label: { EN: 'Analyze', CN: '分析' },
    states: ['S4_ANALYSIS_LOADING', 'S5_ANALYSIS_SUMMARY', 'S5a_RISK_CHECK'],
  },
  {
    id: 'compare',
    icon: GitCompareArrows,
    label: { EN: 'Compare', CN: '对比' },
    states: ['S6_BUDGET', 'S7_PRODUCT_RECO'],
  },
  {
    id: 'checkout',
    icon: Wallet,
    label: { EN: 'Checkout', CN: '结账' },
    states: ['S8_CHECKOUT', 'S9_SUCCESS', 'S10_FAILURE', 'S11_RECOVERY'],
  },
];

export function AuroraStepIndicator({ currentState, language }: AuroraStepIndicatorProps) {
  const getStepStatus = (step: Step): 'active' | 'completed' | 'pending' => {
    const stateOrder: FlowState[] = [
      'S0_LANDING', 'S1_OPEN_INTENT', 'S2_DIAGNOSIS', 'S3_PHOTO_OPTION', 'S3a_PHOTO_QC',
      'S4_ANALYSIS_LOADING', 'S5_ANALYSIS_SUMMARY', 'S5a_RISK_CHECK', 'S6_BUDGET',
      'S7_PRODUCT_RECO', 'S8_CHECKOUT', 'S9_SUCCESS', 'S10_FAILURE', 'S11_RECOVERY'
    ];
    
    const currentIndex = stateOrder.indexOf(currentState);
    const stepMinIndex = Math.min(...step.states.map(s => stateOrder.indexOf(s)));
    const stepMaxIndex = Math.max(...step.states.map(s => stateOrder.indexOf(s)));
    
    if (step.states.includes(currentState)) return 'active';
    if (currentIndex > stepMaxIndex) return 'completed';
    return 'pending';
  };

  return (
    <div className="px-4 py-2 bg-card border-b border-border">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {STEPS.map((step, idx) => {
          const status = getStepStatus(step);
          const Icon = step.icon;
          
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  status === 'active' 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : status === 'completed'
                    ? 'bg-success/20 text-success'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className={`text-[10px] font-medium ${
                  status === 'active' 
                    ? 'text-primary' 
                    : status === 'completed'
                    ? 'text-success'
                    : 'text-muted-foreground'
                }`}>
                  {step.label[language]}
                </span>
              </div>
              
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                  getStepStatus(STEPS[idx + 1]) !== 'pending' 
                    ? 'bg-success/30' 
                    : 'bg-muted'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
