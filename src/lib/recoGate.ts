import type { AgentState } from './agentStateMachine';
import type { Card } from './pivotaAgentBff';

export const filterRecommendationCardsForState = (cards: Card[], agentState: AgentState): Card[] => {
  const allow = agentState === 'RECO_GATE' || agentState === 'RECO_CONSTRAINTS' || agentState === 'RECO_RESULTS';
  if (allow) return cards;
  return (Array.isArray(cards) ? cards : []).filter((c) => String((c as any)?.type || '').toLowerCase() !== 'recommendations');
};

