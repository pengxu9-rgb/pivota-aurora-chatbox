import React, { useEffect, useRef } from 'react';
import { FlowState, Language } from '@/lib/types';
import { Terminal, Box, GitCompareArrows, Wallet, CheckCircle2, ChevronRight, X } from 'lucide-react';

interface AuroraDiagnosisProgressProps {
  currentState: FlowState;
  language: Language;
  onExpand?: () => void;
  onDismiss?: () => void;
}

interface ProgressStep {
  id: string;
  icon: React.ElementType;
  label: { EN: string; CN: string };
  states: FlowState[];
}

const STEPS: ProgressStep[] = [
  {
    id: 'input',
    icon: Terminal,
    label: { EN: 'Profile', CN: '资料' },
    states: ['S0_LANDING', 'S1_OPEN_INTENT', 'S2_DIAGNOSIS', 'S3_PHOTO_OPTION', 'S3a_PHOTO_QC'],
  },
  {
    id: 'analyze',
    icon: Box,
    label: { EN: 'Analysis', CN: '分析' },
    states: ['S4_ANALYSIS_LOADING', 'S5_ANALYSIS_SUMMARY', 'S5a_RISK_CHECK'],
  },
  {
    id: 'compare',
    icon: GitCompareArrows,
    label: { EN: 'Products', CN: '产品' },
    states: ['S6_BUDGET', 'S7_PRODUCT_RECO'],
  },
  {
    id: 'checkout',
    icon: Wallet,
    label: { EN: 'Complete', CN: '完成' },
    states: ['S8_CHECKOUT', 'S9_SUCCESS', 'S10_FAILURE', 'S11_RECOVERY'],
  },
];

export function AuroraDiagnosisProgress({ currentState, language, onExpand, onDismiss }: AuroraDiagnosisProgressProps) {
  const didAutoDismissRef = useRef(false);
  const stateOrder: FlowState[] = [
    'S0_LANDING',
    'S1_OPEN_INTENT',
    'S2_DIAGNOSIS',
    'S3_PHOTO_OPTION',
    'S3a_PHOTO_QC',
    'S4_ANALYSIS_LOADING',
    'S5_ANALYSIS_SUMMARY',
    'S5a_RISK_CHECK',
    'S6_BUDGET',
    'S7_PRODUCT_RECO',
    'S8_CHECKOUT',
    'S9_SUCCESS',
    'S10_FAILURE',
    'S11_RECOVERY',
  ];

  const currentIndex = stateOrder.indexOf(currentState);
  const recoIndex = stateOrder.indexOf('S7_PRODUCT_RECO');
  const recoReady = currentIndex >= 0 && recoIndex >= 0 && currentIndex >= recoIndex;

  useEffect(() => {
    if (!recoReady) {
      didAutoDismissRef.current = false;
      return;
    }
    if (!onDismiss || didAutoDismissRef.current) return;
    didAutoDismissRef.current = true;

    const id = window.setTimeout(() => {
      onDismiss?.();
    }, 1200);

    return () => window.clearTimeout(id);
  }, [onDismiss, recoReady]);

  const getStepStatus = (step: ProgressStep): 'active' | 'completed' | 'pending' => {
    if (recoReady) return 'completed';
    const stepMinIndex = Math.min(...step.states.map(s => stateOrder.indexOf(s)));
    const stepMaxIndex = Math.max(...step.states.map(s => stateOrder.indexOf(s)));
    
    if (step.states.includes(currentState)) return 'active';
    if (currentIndex > stepMaxIndex) return 'completed';
    return 'pending';
  };

  const activeStepIndex = recoReady ? -1 : STEPS.findIndex(s => s.states.includes(currentState));
  const completedCount = STEPS.filter(s => getStepStatus(s) === 'completed').length;
  const progressPercent = recoReady
    ? 100
    : Math.round(((completedCount + (activeStepIndex >= 0 ? 0.5 : 0)) / STEPS.length) * 100);

  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
      {/* Compact header with progress */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">A</span>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              {language === 'EN' ? 'Skin Diagnosis' : '皮肤诊断'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {language === 'EN' ? `${progressPercent}% complete` : `已完成 ${progressPercent}%`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onExpand ? (
            <button
              onClick={onExpand}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
            >
              {language === 'EN' ? 'Details' : '详情'}
              <ChevronRight className="w-3 h-3" />
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={language === 'EN' ? 'Dismiss' : '收起'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const status = getStepStatus(step);
          const Icon = step.icon;
          
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  status === 'active' 
                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20' 
                    : status === 'completed'
                    ? 'bg-success/20 text-success'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className={`text-[9px] font-medium ${
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
                <div className={`flex-1 h-0.5 mx-1.5 rounded-full transition-colors ${
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
