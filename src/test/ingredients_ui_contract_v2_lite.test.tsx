import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IngredientReportCard } from '@/components/aurora/cards/IngredientReportCard';
import { RecommendationsCard } from '@/pages/BffChat';
import type { Card } from '@/lib/pivotaAgentBff';

describe('ingredients v2-lite ui contract', () => {
  it('renders non-empty readable placeholders for empty benefits/watchouts in report card', () => {
    render(
      <IngredientReportCard
        payload={{
          schema_version: 'aurora.ingredient_report.v2-lite',
          locale: 'en-US',
          ingredient: {
            inci: 'Octocrylene',
            display_name: 'Octocrylene',
            aliases: [],
            category: 'uv filter',
          },
          verdict: {
            one_liner: 'Quick ingredient summary is available.',
            top_benefits: [],
            evidence_grade: null,
            irritation_risk: null,
            time_to_results: null,
            confidence: null,
          },
          benefits: [],
          how_to_use: {
            frequency: null,
            routine_step: null,
            pair_well: [],
            consider_separating: [],
            notes: [],
          },
          watchouts: [],
          use_cases: [],
          evidence: {
            summary: '',
            citations: [],
            show_citations_by_default: false,
          },
          next_questions: [],
          research_status: 'queued',
        }}
        language="EN"
        showNextQuestions={false}
      />,
    );

    expect(screen.getByText(/Quick result now; enhanced evidence is generating\./i)).toBeInTheDocument();
    expect(screen.getByText(/Benefit details are limited for now; showing a readable baseline\./i)).toBeInTheDocument();
    expect(screen.getByText(/No specific watchouts yet; start low and monitor tolerance\./i)).toBeInTheDocument();
    expect(screen.queryByText(/Ingredient report payload is unavailable\./i)).not.toBeInTheDocument();
  });

  it('hides internal warning codes and shows only user-visible warning labels by default', () => {
    const card: Card = {
      card_id: 'reco_warning_visibility',
      type: 'recommendations',
      payload: {
        recommendations: [
          {
            step: 'treatment',
            reasons: ['Matched to your goal and tolerance profile.'],
            sku: {
              brand: 'Mock',
              display_name: 'Barrier Serum',
            },
          },
        ],
        warnings: ['analysis_missing', 'recent_logs_missing', 'over_budget'],
        warning_codes_internal: ['analysis_missing', 'recent_logs_missing', 'over_budget'],
        warning_codes_user_visible: ['over_budget'],
      },
    };

    render(<RecommendationsCard card={card} language="EN" debug={false} />);

    expect(screen.getByText(/May be over budget/i)).toBeInTheDocument();
    expect(screen.queryByText(/No recent 7-day skin logs/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/analysis_missing/i)).not.toBeInTheDocument();
  });
});

