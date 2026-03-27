import React from 'react';
import { fireEvent, render, screen, waitFor } from '@/test/testProviders';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/pivotaAgentBff', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pivotaAgentBff')>('@/lib/pivotaAgentBff');
  return {
    ...actual,
    bffJson: vi.fn(),
    bffChatStream: vi.fn().mockRejectedValue(new Error('stream unavailable in test')),
    sendRecoEmployeeFeedback: vi.fn(),
  };
});

import BffChat from '@/pages/BffChat';
import { ShopProvider } from '@/contexts/shop';
import { bffJson } from '@/lib/pivotaAgentBff';
import type { V1Envelope } from '@/lib/pivotaAgentBff';

function makeEnvelope(args?: Partial<V1Envelope>): V1Envelope {
  return {
    request_id: args?.request_id ?? 'req_bootstrap',
    trace_id: args?.trace_id ?? 'trace_bootstrap',
    assistant_message: args?.assistant_message ?? null,
    suggested_chips: args?.suggested_chips ?? [],
    cards: args?.cards ?? [],
    session_patch: args?.session_patch ?? {},
    events: args?.events ?? [],
  };
}

const warningText = 'Photo modules card is temporarily unavailable (invalid payload), downgraded safely.';

const invalidPhotoModulesCard = {
  card_id: 'photo_modules_invalid',
  type: 'photo_modules_v1',
  payload: {
    used_photos: true,
    quality_grade: 'pass',
    regions: [],
  },
};

const validPhotoModulesCard = {
  card_id: 'photo_modules_valid',
  type: 'photo_modules_v1',
  payload: {
    used_photos: true,
    quality_grade: 'pass',
    photo_notice: 'Photo evidence attached.',
    face_crop: {
      crop_id: 'crop_valid',
      coord_space: 'orig_px_v1',
      bbox_px: { x: 12, y: 18, w: 220, h: 220 },
      orig_size_px: { w: 480, h: 480 },
      render_size_px_hint: { w: 320, h: 320 },
      crop_image_url: 'https://example.com/crop.png',
      original_image_url: 'https://example.com/original.png',
    },
    regions: [
      {
        region_id: 'reg_1',
        type: 'bbox',
        issue_type: 'redness',
        coord_space: 'face_crop_norm_v1',
        bbox: { x: 0.18, y: 0.2, w: 0.22, h: 0.18 },
        style: { intensity: 0.7, priority: 0.3, label_hint: 'redness' },
      },
    ],
    modules: [
      {
        module_id: 'left_cheek',
        issues: [
          {
            issue_type: 'redness',
            severity_0_4: 3,
            confidence_0_1: 0.84,
            evidence_region_ids: ['reg_1'],
            explanation_short: 'Redness is the top visible signal for this module.',
          },
        ],
        actions: [],
        products: [],
      },
    ],
    summary_v1: {
      top_module_id: 'left_cheek',
      top_issue_type: 'redness',
    },
    disclaimers: {
      non_medical: true,
      seek_care_triggers: ['If redness worsens, seek professional care.'],
    },
  },
};

const analysisStoryCard = {
  card_id: 'analysis_story_v2_valid',
  type: 'analysis_story_v2',
  payload: {
    ui_card_v1: {
      headline: 'Photo review highlights left cheek redness first.',
      key_points: ['Redness is the top visible signal in the uploaded photo.'],
      actions_now: ['AM: Gentle cleanse'],
      avoid_now: ['Avoid stacking strong acids tonight.'],
      next_checkin: 'Week 1: retake the same angle in even lighting.',
    },
    confidence_overall: { level: 'medium' },
    priority_findings: [
      {
        priority: 1,
        title: 'Redness remains the main visible issue.',
        evidence_region_or_module: ['Left cheek'],
      },
    ],
  },
};

const READY_TIMEOUT_MS = 5000;

async function waitForEnabledComposer() {
  const input = await screen.findByPlaceholderText(/ask a question/i);
  await waitFor(() => expect(input).not.toBeDisabled(), { timeout: READY_TIMEOUT_MS });
  return input;
}

describe('photo_modules invalid payload visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('lang_pref', 'en');
    window.history.pushState({}, '', '/chat');
    if (!HTMLElement.prototype.scrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: vi.fn(),
        writable: true,
      });
    }
  });

  it('hides invalid payload warning in non-debug mode', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeEnvelope({
            assistant_message: { content: 'photo invalid payload' },
            cards: [invalidPhotoModulesCard],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'show my cards' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => {
      const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
      expect(chatCalls.length).toBeGreaterThan(0);
      expect(screen.queryByText(warningText)).not.toBeInTheDocument();
    }, { timeout: READY_TIMEOUT_MS });
  });

  it('shows invalid payload warning in debug mode', async () => {
    window.history.pushState({}, '', '/chat?debug=1');
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeEnvelope({
            assistant_message: { content: 'photo invalid payload' },
            cards: [invalidPhotoModulesCard],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat?debug=1']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'show my cards' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    await waitFor(() => {
      const chatCalls = mock.mock.calls.filter((call) => call[0] === '/v1/chat');
      expect(chatCalls.length).toBeGreaterThan(0);
    }, { timeout: READY_TIMEOUT_MS });
    expect(await screen.findByText(warningText, {}, { timeout: READY_TIMEOUT_MS })).toBeInTheDocument();
  });

  it('renders valid photo_modules_v1 together with analysis_story_v2 in chat history', async () => {
    const mock = vi.mocked(bffJson);
    mock.mockImplementation((path: string) => {
      if (path === '/v1/session/bootstrap') return Promise.resolve(makeEnvelope());
      if (path === '/v1/chat') {
        return Promise.resolve(
          makeEnvelope({
            assistant_message: { content: 'photo analysis ready' },
            cards: [validPhotoModulesCard, analysisStoryCard],
          }),
        );
      }
      return Promise.resolve(makeEnvelope());
    });

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ShopProvider>
          <BffChat />
        </ShopProvider>
      </MemoryRouter>,
    );

    const input = await waitForEnabledComposer();
    fireEvent.change(input, { target: { value: 'show my photo analysis' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByText('Photo analysis', {}, { timeout: READY_TIMEOUT_MS })).toBeInTheDocument();
    expect(await screen.findByText('Current focus: Left cheek · Redness', {}, { timeout: READY_TIMEOUT_MS })).toBeInTheDocument();
    expect(await screen.findByText('Skin analysis', {}, { timeout: READY_TIMEOUT_MS })).toBeInTheDocument();
    expect(await screen.findByText('Photo review highlights left cheek redness first.', {}, { timeout: READY_TIMEOUT_MS })).toBeInTheDocument();
  });
});
