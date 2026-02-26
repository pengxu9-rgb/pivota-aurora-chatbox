import type { AgentState } from './agentStateMachine';
import type { Card } from './pivotaAgentBff';

export const filterRecommendationCardsForState = (cards: Card[], agentState: AgentState): Card[] => {
  void agentState;
  return Array.isArray(cards) ? cards : [];
};
