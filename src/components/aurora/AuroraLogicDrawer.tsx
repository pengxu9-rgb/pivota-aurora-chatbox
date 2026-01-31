import React from 'react';
import { 
  Terminal, 
  MessageSquareText, 
  Box, 
  Calculator, 
  GitCompareArrows, 
  Layers, 
  Wallet,
  X,
  CheckCircle2
} from 'lucide-react';
import { FlowState, Language } from '@/lib/types';
import { t } from '@/lib/i18n';

interface AuroraLogicDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentState: FlowState;
  language: Language;
}

interface LogicStep {
  id: string;
  icon: React.ElementType;
  label: { EN: string; CN: string };
  group: 'io' | 'engine' | 'strategy';
  states: FlowState[];
}

const LOGIC_STEPS: LogicStep[] = [
  {
    id: 'input',
    icon: Terminal,
    label: { EN: 'Input Parsing & Profile', CN: '输入解析 & 画像' },
    group: 'io',
    states: ['S0_LANDING', 'S1_OPEN_INTENT', 'S2_DIAGNOSIS', 'S3_PHOTO_OPTION', 'S3a_PHOTO_QC'],
  },
  {
    id: 'output',
    icon: MessageSquareText,
    label: { EN: 'Final Output Preview', CN: '最终输出预览' },
    group: 'io',
    states: ['S9_SUCCESS', 'S10_FAILURE', 'S11_RECOVERY'],
  },
  {
    id: 'vectorization',
    icon: Box,
    label: { EN: 'SKU Vectorization', CN: 'SKU 向量化' },
    group: 'engine',
    states: ['S4_ANALYSIS_LOADING'],
  },
  {
    id: 'scoring',
    icon: Calculator,
    label: { EN: 'Scoring & VETO', CN: '评分与裁决' },
    group: 'engine',
    states: ['S5_ANALYSIS_SUMMARY', 'S5a_RISK_CHECK'],
  },
  {
    id: 'dupe',
    icon: GitCompareArrows,
    label: { EN: 'Dupe / Compare', CN: 'Dupe / 对比' },
    group: 'engine',
    states: ['S7_PRODUCT_RECO'],
  },
  {
    id: 'routine',
    icon: Layers,
    label: { EN: 'Routine & Compatibility', CN: '搭配与禁忌' },
    group: 'strategy',
    states: ['S7_PRODUCT_RECO'],
  },
  {
    id: 'budget',
    icon: Wallet,
    label: { EN: 'High-Low Budget', CN: 'High-Low 预算' },
    group: 'strategy',
    states: ['S6_BUDGET', 'S8_CHECKOUT'],
  },
];

const GROUP_LABELS = {
  io: { EN: 'I/O LAYER', CN: 'I/O 层' },
  engine: { EN: 'CORE ENGINE', CN: '核心引擎' },
  strategy: { EN: 'STRATEGY LAYER', CN: '策略层' },
};

export function AuroraLogicDrawer({ isOpen, onClose, currentState, language }: AuroraLogicDrawerProps) {
  const getStepStatus = (step: LogicStep): 'active' | 'completed' | 'pending' => {
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

  const renderGroup = (groupId: 'io' | 'engine' | 'strategy') => {
    const groupSteps = LOGIC_STEPS.filter(s => s.group === groupId);
    
    return (
      <div key={groupId} className="space-y-2">
        <h3 className="section-label text-slate-500 px-3">
          {GROUP_LABELS[groupId][language]}
        </h3>
        <div className="space-y-1">
          {groupSteps.map((step, idx) => {
            const status = getStepStatus(step);
            const Icon = step.icon;
            
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  status === 'active' 
                    ? 'bg-primary/20 text-white' 
                    : status === 'completed'
                    ? 'text-slate-400'
                    : 'text-slate-500'
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                  status === 'active' 
                    ? 'bg-primary text-white' 
                    : status === 'completed'
                    ? 'bg-success/20 text-success'
                    : 'bg-slate-800'
                }`}>
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className={`text-sm ${status === 'active' ? 'font-medium' : ''}`}>
                  {idx + 1}. {step.label[language]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="logic-drawer-backdrop opacity-100"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`logic-drawer ${isOpen ? 'logic-drawer-open' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Aurora v4.0</h2>
              <p className="text-slate-500 text-xs">Beauty Decision System</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        
        {/* Current State Indicator */}
        <div className="p-4 border-b border-slate-700">
          <p className="section-label text-slate-500 mb-2">
            {language === 'EN' ? 'CURRENT STATE' : '当前状态'}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <code className="text-primary text-sm font-mono">{currentState}</code>
          </div>
        </div>
        
        {/* Logic Steps */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-200px)]">
          {renderGroup('io')}
          {renderGroup('engine')}
          {renderGroup('strategy')}
        </div>
      </div>
    </>
  );
}
