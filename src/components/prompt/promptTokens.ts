export type PromptSelectionMode = 'single' | 'multiple';

export const promptTokens = {
  sheet: {
    radius: 22,
    paddingX: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  optionCard: {
    radius: 16,
    singleHeight: 50,
    multiLineHeight: 64,
  },
  footer: {
    primaryHeight: 56,
    primaryRadius: 16,
  },
} as const;

