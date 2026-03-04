import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AnalysisStoryCard } from '@/components/aurora/cards/AnalysisStoryCard';

describe('analysis_story_v2 dedupe', () => {
  it('dedupes current_strengths when they overlap with priority findings', () => {
    render(
      <AnalysisStoryCard
        language="EN"
        payload={{
          skin_profile: {
            skin_type_tendency: 'combination',
            sensitivity_tendency: 'medium',
            current_strengths: [
              'Some uneven tone/dark spot tendency (severe): prioritize consistent SPF and gentle brightening pace.',
              'Some acne-like red bump tendency (moderate): prioritize gentle + low-irritation first, then step up acne control gradual',
              'Barrier is mostly stable this week.',
            ],
          },
          priority_findings: [
            { title: 'Some uneven tone/dark spot tendency (severe): prioritize consistent SPF and gentle brightening pace.' },
            { title: 'Some acne-like red bump tendency (moderate): prioritize gentle + low-irritation first, then step up acne control gradual' },
          ],
        }}
      />,
    );

    const profileHeading = screen.getByText('Current profile');
    const profileSection = profileHeading.parentElement;
    expect(profileSection).toBeTruthy();
    const profile = within(profileSection as HTMLElement);

    expect(profile.getByText('combination')).toBeInTheDocument();
    expect(profile.getByText('medium')).toBeInTheDocument();
    expect(profile.getByText('Barrier is mostly stable this week.')).toBeInTheDocument();
    expect(profile.queryByText(/uneven tone\/dark spot tendency/i)).not.toBeInTheDocument();
    expect(profile.queryByText(/acne-like red bump tendency/i)).not.toBeInTheDocument();
  });

  it('hides current profile block when dedupe leaves no profile bullets', () => {
    render(
      <AnalysisStoryCard
        language="EN"
        payload={{
          skin_profile: {
            current_strengths: ['Mild redness around cheek'],
          },
          priority_findings: [{ title: 'Mild redness around cheek' }],
        }}
      />,
    );

    expect(screen.queryByText('Current profile')).not.toBeInTheDocument();
    expect(screen.getByText('Priority findings')).toBeInTheDocument();
  });
});
