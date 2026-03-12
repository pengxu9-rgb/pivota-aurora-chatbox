import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuroraLoadingCard } from '@/components/aurora/cards/AuroraLoadingCard';
import { AuroraProfileCard } from '@/components/aurora/cards/AuroraProfileCard';
import { SkinIdentityCard } from '@/components/aurora/cards/SkinIdentityCard';
import { ProductAnalysisCard } from '@/components/chat/cards/ProductAnalysisCard';

describe('multilingual card fallbacks phase 2', () => {
  it('falls back to English in AuroraLoadingCard for FR', () => {
    render(<AuroraLoadingCard language="FR" intent="default" onSkip={() => {}} />);

    expect(screen.getByText('AURORA THINKING')).toBeInTheDocument();
    expect(screen.getByText('Analyzing Skin Profile...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue without analysis' })).toBeInTheDocument();
    expect(screen.queryByText('AURORA 思考中')).not.toBeInTheDocument();
  });

  it('falls back to English in SkinIdentityCard for FR', () => {
    const onAction = vi.fn();
    render(
      <SkinIdentityCard
        language="FR"
        onAction={onAction}
        payload={{
          diagnosis: {
            skinType: 'oily',
            concerns: ['acne'],
            currentRoutine: 'basic',
            barrierStatus: 'healthy',
          },
          photoHint: true,
        }}
      />,
    );

    expect(screen.getByText('Skin Identity')).toBeInTheDocument();
    expect(screen.getByText('Based on your self-reported profile. Photos can improve accuracy.')).toBeInTheDocument();
    expect(screen.getByText('Skin type:')).toBeInTheDocument();
    expect(screen.getByText('Barrier:')).toBeInTheDocument();
    expect(screen.getByText('Concerns')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload photo (recommended)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue without photos' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove acne\/breakouts/i }));
    expect(onAction).toHaveBeenCalledWith('profile_update_concerns', { concerns: [] });
  });

  it('falls back to English in ProductAnalysisCard for FR', () => {
    const onAction = vi.fn();

    render(
      <ProductAnalysisCard
        language="FR"
        onAction={onAction}
        result={{
          productName: 'Hydra Serum',
          brand: 'Aurora Lab',
          matchScore: 84,
          suitability: 'good',
          mechanisms: [
            { vector: 'hydrating', strength: 88 },
            { vector: 'brightening', strength: 61 },
          ],
          ingredients: {
            beneficial: ['Glycerin', 'Niacinamide'],
            caution: ['Fragrance'],
            veto: 'Contains a known irritant for very reactive skin.',
          },
          usageAdvice: {
            timing: 'AM',
            notes: 'Use after cleansing and before moisturizer.',
          },
          dupeRecommendation: {
            name: 'Daily Dew',
            brand: 'Aurora Lab',
            reason: 'Similar hydration support at a lower price.',
            savingsPercent: 32,
          },
          skinProfileMatch: {
            skinType: 'oily',
            matchedConcerns: ['acne'],
            unmatchedConcerns: ['dark_spots'],
          },
        }}
      />,
    );

    expect(screen.getByText('Good Match')).toBeInTheDocument();
    expect(screen.getByText('Matched to your oily skin profile')).toBeInTheDocument();
    expect(screen.getByText('Addresses:')).toBeInTheDocument();
    expect(screen.getByText('Acne/Breakouts')).toBeInTheDocument();
    expect(screen.getByText('Does not address:')).toBeInTheDocument();
    expect(screen.getByText('Dark spots')).toBeInTheDocument();
    expect(screen.getByText('VETO: Not suitable for your skin')).toBeInTheDocument();
    expect(screen.getByText('Product Vector Radar')).toBeInTheDocument();
    expect(screen.getByText('Mechanism Vectors')).toBeInTheDocument();
    expect(screen.getByText('Beneficial')).toBeInTheDocument();
    expect(screen.getByText('Caution')).toBeInTheDocument();
    expect(screen.getByText('Morning Use')).toBeInTheDocument();
    expect(screen.getByText('Budget Alternative')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onAction).toHaveBeenCalledWith('product_analysis_done');
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Another' }));
    expect(onAction).toHaveBeenCalledWith('product_analysis_another');
  });

  it('falls back to English in AuroraProfileCard for FR', () => {
    const onAction = vi.fn();
    render(<AuroraProfileCard language="FR" onAction={onAction} />);

    expect(screen.getByText('PROFILE BUILDER')).toBeInTheDocument();
    expect(screen.getByText('Tell me about your skin')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /oily/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: /acne\/breakouts/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Barrier Health')).toBeInTheDocument();
    expect(screen.getByText('Healthy - No issues')).toBeInTheDocument();
    expect(screen.getByText('Impaired - Some sensitivity')).toBeInTheDocument();
    expect(screen.getByText('Not sure')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Impaired - Some sensitivity' }));
    expect(screen.getByText('Barrier stressed')).toBeInTheDocument();
  });
});
