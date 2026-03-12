import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SmartBudgetReceipt } from '@/components/aurora/SmartBudgetReceipt';
import { AuroraDiagnosisProgress } from '@/components/aurora/cards/AuroraDiagnosisProgress';
import { EnvStressCard } from '@/components/aurora/cards/EnvStressCard';
import { AffiliateOutcomeCard } from '@/components/chat/cards/AffiliateOutcomeCard';
import { DiagnosisV2ThinkingCard } from '@/components/chat/cards/DiagnosisV2ThinkingCard';
import { IngredientGoalMatchCard } from '@/components/chat/cards/IngredientGoalMatchCard';
import { PhotoUploadCard } from '@/components/chat/cards/PhotoUploadCard';
import { ReturnWelcomeCard } from '@/components/chat/cards/ReturnWelcomeCard';
import { DestinationDisambiguationDialog } from '@/components/travel/DestinationDisambiguationDialog';

describe('multilingual component fallbacks', () => {
  it('renders localized French copy in the destination disambiguation dialog for FR', () => {
    render(
      <DestinationDisambiguationDialog
        open={true}
        language="FR"
        field="departure"
        normalizedQuery=""
        candidates={[
          {
            label: 'Paris',
            latitude: 48.8566,
            longitude: 2.3522,
            admin1: 'Ile-de-France',
            country: 'France',
          },
        ]}
        onSelect={() => {}}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText('Confirmer le départ')).toBeInTheDocument();
    expect(screen.getByText(/Ce lieu de départ/)).toBeInTheDocument();
    expect(screen.queryByText('确认出发地')).not.toBeInTheDocument();
  });

  it('keeps Chinese copy in the destination disambiguation dialog for CN', () => {
    render(
      <DestinationDisambiguationDialog
        open={true}
        language="CN"
        field="destination"
        normalizedQuery=""
        candidates={[
          {
            label: 'Tokyo',
            latitude: 35.6762,
            longitude: 139.6503,
            admin1: 'Tokyo',
            country: 'Japan',
          },
        ]}
        onSelect={() => {}}
        onOpenChange={() => {}}
      />,
    );

    expect(screen.getByText('确认目的地')).toBeInTheDocument();
    expect(screen.getByText(/存在多个候选/)).toBeInTheDocument();
  });

  it('falls back to English in the return welcome card for FR', () => {
    render(
      <ReturnWelcomeCard
        language="FR"
        summary={{
          goal_primary: 'acne',
          plan_am_short: ['Cleanser'],
          plan_pm_short: ['Moisturizer'],
          sensitivities: ['Fragrance'],
          days_since_last: 3,
          checkin_due: false,
        }}
        chips={[]}
        onChip={() => {}}
      />,
    );

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText('Last time we were working on: Breakouts')).toBeInTheDocument();
    expect(screen.getByText('Your current plan')).toBeInTheDocument();
    expect(screen.getByText('3 days')).toBeInTheDocument();
  });

  it('falls back to English in the ingredient goal match card for FR', () => {
    const onAction = vi.fn();

    render(
      <IngredientGoalMatchCard
        language="FR"
        payload={{
          candidate_ingredients: [
            { ingredient: 'Niacinamide', reason: 'Supports brightening', evidence_grade: 'A' },
          ],
        }}
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Goal match: Ingredient goal match')).toBeInTheDocument();
    expect(screen.getByText('Sensitivity: Unknown')).toBeInTheDocument();
    expect(screen.getByText('Evidence A')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'See products (optional)' }));
    expect(onAction).toHaveBeenCalledWith(
      'chip.start.reco_products',
      expect.objectContaining({
        ingredient_candidates: ['Niacinamide'],
        ingredient_goal: 'barrier',
      }),
    );
  });

  it('falls back to English in diagnosis thinking copy for FR', () => {
    render(
      <DiagnosisV2ThinkingCard
        language="FR"
        steps={[
          { stage: 'goal_understanding', status: 'done', text: 'Goal captured' },
          { stage: 'inference', status: 'in_progress', text: 'Analyzing skin state' },
        ]}
      />,
    );

    expect(screen.getByText('Deep analysis in progress...')).toBeInTheDocument();
    expect(screen.getByText('Understanding your goals')).toBeInTheDocument();
    expect(screen.getAllByText('Analyzing skin state').length).toBeGreaterThan(0);
  });

  it('falls back to English in smart budget receipt for FR', () => {
    render(
      <SmartBudgetReceipt
        language="FR"
        initialOpen={true}
        floating={false}
        items={[
          { id: '1', name: 'Cleanser', price: 18, currency: 'USD' },
          { id: '2', name: 'SPF', price: 24, currency: 'USD' },
        ]}
      />,
    );

    expect(screen.getByText('Smart Budget')).toBeInTheDocument();
    expect(screen.getByText('Receipt')).toBeInTheDocument();
    expect(screen.getByText('Daily Cost')).toBeInTheDocument();
    expect(screen.getByText('Items')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.queryByText('智能预算')).not.toBeInTheDocument();
  });

  it('falls back to English in affiliate outcome card for FR', () => {
    render(
      <AffiliateOutcomeCard
        language="FR"
        affiliateItems={[
          {
            product: {
              product_id: 'prod_1',
              name: 'Hydrating Serum',
              brand: 'Aurora',
              category: 'serum',
              image_url: 'https://example.com/product.png',
            } as any,
            offer: {
              offer_id: 'offer_1',
              affiliate_url: 'https://example.com/buy',
              currency: 'USD',
              price: 35,
              seller: 'Retailer',
            } as any,
          },
        ]}
        onAction={() => {}}
      />,
    );

    expect(screen.getByText('EXTERNAL PURCHASE')).toBeInTheDocument();
    expect(screen.getByText('Complete your purchase on retailer sites')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✅ I completed my purchase' })).toBeInTheDocument();
  });

  it('falls back to English in aurora diagnosis progress for FR', () => {
    render(<AuroraDiagnosisProgress currentState="S4_ANALYSIS_LOADING" language="FR" onExpand={() => {}} onDismiss={() => {}} />);

    expect(screen.getByText('Skin Diagnosis')).toBeInTheDocument();
    expect(screen.getByText(/% complete/)).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Details' })).toBeInTheDocument();
  });

  it('falls back to English in env stress card for FR', () => {
    render(
      <EnvStressCard
        language="FR"
        payload={{
          schema_version: 'aurora.ui.env_stress.v1',
          ess: 66,
          tier: 'Moderate',
          notes: [],
        } as any}
      />,
    );

    expect(screen.getByText('Environment Stress')).toBeInTheDocument();
    expect(screen.getByText('A bounded, explainable stress signal (ESS).')).toBeInTheDocument();
    expect(screen.getByText(/Tier:\s*Moderate/)).toBeInTheDocument();
    expect(screen.queryByText('环境压力')).not.toBeInTheDocument();
  });

  it('falls back to English in photo upload card for FR', () => {
    render(<PhotoUploadCard onAction={() => {}} language="FR" />);

    expect(screen.getAllByText('Upload image').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Frame camera').length).toBeGreaterThan(0);
    expect(screen.queryByText('框内拍照')).not.toBeInTheDocument();
  });
});
