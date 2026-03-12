import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuroraAnchorCard } from '@/components/aurora/cards/AuroraAnchorCard';
import { AuroraBudgetCard } from '@/components/aurora/cards/AuroraBudgetCard';
import { AuroraRoutineCard } from '@/components/aurora/cards/AuroraRoutineCard';
import { AuroraScoringCard } from '@/components/aurora/cards/AuroraScoringCard';

describe('multilingual card fallbacks phase 3', () => {
  it('falls back to English in AuroraAnchorCard for FR', () => {
    const onSelect = vi.fn();

    render(
      <AuroraAnchorCard
        language="FR"
        onSelect={onSelect}
        product={{
          product_id: 'prod_anchor',
          name: 'Barrier Serum',
          brand: 'Aurora Lab',
          category: 'unknown',
          image_url: '',
        } as any}
        offers={[
          {
            offer_id: 'offer_anchor',
            price: 42,
            original_price: 55,
            badges: ['best_price', 'fastest_shipping'],
          } as any,
        ]}
        mechanismVector={{
          oilControl: 45,
          soothing: 82,
          repair: 77,
          brightening: 36,
        }}
        vetoReason="Contains a likely irritant."
      />,
    );

    expect(screen.getByText('Skincare')).toBeInTheDocument();
    expect(screen.getByText('MECHANISM VECTOR')).toBeInTheDocument();
    expect(screen.getByText(/Best price/)).toBeInTheDocument();
    expect(screen.getByText(/Fastest/)).toBeInTheDocument();
    expect(screen.getByText('Not recommended for sensitive/reactive skin. May cause increased irritation.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select This Product' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('falls back to English in AuroraRoutineCard for FR', () => {
    const onStepClick = vi.fn();
    const onStepSecondaryAction = vi.fn();

    render(
      <AuroraRoutineCard
        language="FR"
        compatibility="known"
        compatibilitySummary="Keep actives separated by time of day."
        conflicts={['Retinol and AHA together may irritate.']}
        amSteps={[
          {
            category: 'cleanser',
            product: { brand: 'Aurora', name: 'Gentle Wash' },
            type: 'premium',
            external: true,
            secondaryLabel: 'Compare',
          },
        ]}
        pmSteps={[
          {
            category: 'moisturizer',
            product: { brand: 'Aurora', name: 'Barrier Cream' },
            type: 'dupe',
          },
        ]}
        onStepClick={onStepClick}
        onStepSecondaryAction={onStepSecondaryAction}
      />,
    );

    expect(screen.getByText('ROUTINE & COMPATIBILITY')).toBeInTheDocument();
    expect(screen.getByText('Your Personalized Routine')).toBeInTheDocument();
    expect(screen.getByText(/Conflicts Detected/)).toBeInTheDocument();
    expect(screen.getByText('Morning Routine')).toBeInTheDocument();
    expect(screen.getByText('Evening Routine')).toBeInTheDocument();
    expect(screen.getByText('External')).toBeInTheDocument();
    expect(screen.getByText('Cleanser')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Gentle Wash'));
    expect(onStepClick).toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: /compare/i })[1]);
    expect(onStepSecondaryAction).toHaveBeenCalled();
  });

  it('falls back to English in AuroraBudgetCard for FR', () => {
    const onAction = vi.fn();

    render(<AuroraBudgetCard language="FR" onAction={onAction} />);

    expect(screen.getByText('HIGH-LOW BUDGET')).toBeInTheDocument();
    expect(
      screen.getByText('💡 Strategy: Save on daily basics (cleanser, moisturizer), invest in high-efficacy treatments (serums, actives)'),
    ).toBeInTheDocument();
    expect(screen.getByText('Balanced quality')).toBeInTheDocument();

    fireEvent.click(screen.getByText('$$$ Premium'));
    fireEvent.click(screen.getByRole('button', { name: 'Show recommendations' }));
    expect(onAction).toHaveBeenCalledWith('budget_submit', { budget: '$$$' });
  });

  it('falls back to English in AuroraScoringCard for FR', () => {
    const onAction = vi.fn();

    render(
      <AuroraScoringCard
        language="FR"
        onAction={onAction}
        payload={{
          analysis: {
            features: [
              { observation: 'Barrier looks mildly stressed.', confidence: 'somewhat_sure' },
            ],
            strategy: 'Simplify actives and prioritize barrier repair.',
            needs_risk_check: false,
          } as any,
          session: {
            diagnosis: {
              skinType: 'sensitive',
              concerns: ['redness', 'dehydration'],
              currentRoutine: 'basic',
              barrierStatus: 'impaired',
            },
            photos: {
              daylight: { preview: 'blob:daylight' },
            },
          } as any,
        }}
      />,
    );

    expect(screen.getByText('ASSESSMENT SUMMARY')).toBeInTheDocument();
    expect(screen.getByText('Your Skin Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Skin type:')).toBeInTheDocument();
    expect(screen.getByText('Barrier:')).toBeInTheDocument();
    expect(screen.getByText('Priorities:')).toBeInTheDocument();
    expect(screen.getByText('Based on your answers and 1 photo(s)')).toBeInTheDocument();
    expect(screen.getByText('Strategy')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '🔎 Review my current products first' }));
    expect(onAction).toHaveBeenCalledWith('analysis_review_products');
  });
});
