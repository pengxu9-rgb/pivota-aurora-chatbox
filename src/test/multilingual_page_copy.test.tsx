import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { t as localeT } from '@/locales';
import Home from '@/pages/Home';
import { __resetPersistenceMemoryForTests, setLangPref } from '@/lib/persistence';
import { listActivity } from '@/lib/activityApi';
import { render, screen } from '@/test/testProviders';

const navigateMock = vi.fn();
const outletContext = {
  openSidebar: vi.fn(),
  startChat: vi.fn(),
  openComposer: vi.fn(),
};

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useOutletContext: () => outletContext,
  };
});

vi.mock('@/lib/activityApi', () => ({
  listActivity: vi.fn(),
}));

describe('Multilingual page copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    __resetPersistenceMemoryForTests();
    vi.mocked(listActivity).mockResolvedValue({ items: [], next_cursor: null });
  });

  it('renders french home copy outside the profile page', async () => {
    setLangPref('fr');

    render(<Home />);

    expect(await screen.findByText('Agent peau 24/7')).toBeInTheDocument();
    expect(screen.getByText('Actions rapides')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voir tout' })).toBeInTheDocument();
  });

  it('provides localized non-profile page titles for de/fr/ja', () => {
    expect(localeT('activity.title', 'FR')).toBe('Activité');
    expect(localeT('routine.title', 'DE')).toBe('Meine Routine');
    expect(localeT('explore.title', 'JA')).toBe('探索');
    expect(localeT('plans.title', 'FR')).toBe('Plans');
  });
});
