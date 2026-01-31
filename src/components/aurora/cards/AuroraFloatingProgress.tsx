import React, { useState } from 'react';
import { FlowState, Language } from '@/lib/types';
import { Terminal, Box, GitCompareArrows, Wallet, CheckCircle2, ChevronUp, ChevronDown, X } from 'lucide-react';
import { AuroraLogicDrawer } from '../AuroraLogicDrawer';

interface AuroraFloatingProgressProps {
  currentState: FlowState;
  language: Language;
  isActive: boolean;
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
    label: { EN: 'Profile', CN: '画像' },
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
    label: { EN: 'Match', CN: '匹配' },
    states: ['S6_BUDGET', 'S7_PRODUCT_RECO'],
  },
  {
    id: 'checkout',
    icon: Wallet,
    label: { EN: 'Complete', CN: '完成' },
    states: ['S8_CHECKOUT', 'S9_SUCCESS', 'S10_FAILURE', 'S11_RECOVERY'],
  },
];

export function AuroraFloatingProgress({ currentState, language, isActive, onDismiss }: AuroraFloatingProgressProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  if (!isActive) return null;

  const getStepStatus = (step: ProgressStep): 'active' | 'completed' | 'pending' => {
    const stateOrder: FlowState[] = [
      'S0_LANDING', 'S1_OPEN_INTENT', 'S2_DIAGNOSIS', 'S3_PHOTO_OPTION', 'S3a_PHOTO_QC',
      'S4_ANALYSIS_LOADING', 'S5_ANALYSIS_SUMMARY', 'S5a_RISK_CHECK', 'S6_BUDGET',
      'S7_PRODUCT_RECO', 'S8_CHECKOUT', 'S9_SUCCESS', 'S10_FAILURE', 'S11_RECOVERY'
    ];
    
    const currentIndex = stateOrder.indexOf(currentState);
    const stepMaxIndex = Math.max(...step.states.map(s => stateOrder.indexOf(s)));
    
    if (step.states.includes(currentState)) return 'active';
    if (currentIndex > stepMaxIndex) return 'completed';
    return 'pending';
  };

  const activeStep = STEPS.find(s => s.states.includes(currentState));
  const completedCount = STEPS.filter(s => getStepStatus(s) === 'completed').length;
  const progressPercent = Math.round(((completedCount + (activeStep ? 0.5 : 0)) / STEPS.length) * 100);

  // Don't show when completed
  if (currentState === 'S9_SUCCESS' || currentState === 'S10_FAILURE') {
    return null;
  }

  return (
    <>
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md">
        {/* Collapsed capsule */}
        <div 
          className={`bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-lg transition-all duration-300 overflow-hidden ${
            isExpanded ? 'rounded-b-none' : ''
          }`}
        >
          {/* Main capsule bar */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              {/* Aurora logo */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xs">A</span>
              </div>
              
              {/* Current step info */}
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {language === 'EN' ? 'Skin Diagnosis' : '皮肤诊断'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                    {activeStep?.label[language] || (language === 'EN' ? 'Loading' : '加载中')}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Mini progress bar */}
                  <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {progressPercent}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* Expanded content */}
          {isExpanded && (
            <div className="px-4 pb-3 pt-1 border-t border-border/50 animate-fade-in">
              {/* Steps */}
              <div className="flex items-center justify-between py-2">
                {STEPS.map((step, idx) => {
                  const status = getStepStatus(step);
                  const Icon = step.icon;
                  
                  return (
                    <React.Fragment key={step.id}>
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          status === 'active' 
                            ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20' 
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

              {/* Logic drawer button */}
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="w-full mt-2 py-2 text-xs text-primary hover:text-primary/80 hover:bg-primary/5 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                {language === 'EN' ? 'View Decision Logic' : '查看决策逻辑'}
                <ChevronUp className="w-3 h-3 rotate-90" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Logic Drawer */}
      <AuroraLogicDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentState={currentState}
        language={language}
      />
    </>
  );
}
