import { describe, expect, it } from 'vitest';

import { enrichPhotoModulesPayloadWithSessionPreview } from '@/lib/photoModulesFallback';

describe('photoModulesFallback', () => {
  it('keeps payload unchanged when face_crop already has renderable image url', () => {
    const payload = {
      face_crop: {
        crop_image_url: 'https://example.com/crop.png',
        original_image_url: '',
      },
    };

    const result = enrichPhotoModulesPayloadWithSessionPreview(
      payload,
      [{ slot_id: 'daylight', photo_id: 'p_daylight' }],
      { daylight: { preview: 'data:image/jpeg;base64,from-session' } },
    );

    expect(result).toBe(payload);
    expect((result as any).face_crop.crop_image_url).toBe('https://example.com/crop.png');
  });

  it('fills original_image_url using photo_id -> slot_id -> session preview', () => {
    const payload = {
      face_crop: {
        photo_id: 'p_indoor',
      },
    };

    const result = enrichPhotoModulesPayloadWithSessionPreview(
      payload,
      [{ slot_id: 'indoor_white', photo_id: 'p_indoor' }],
      { indoor_white: { preview: 'data:image/jpeg;base64,indoor-preview' } },
    );

    expect((result as any).face_crop.original_image_url).toBe('data:image/jpeg;base64,indoor-preview');
  });

  it('fills original_image_url directly from slot_id preview', () => {
    const payload = {
      face_crop: {
        slot_id: 'daylight',
      },
    };

    const result = enrichPhotoModulesPayloadWithSessionPreview(payload, [], {
      daylight: { preview: 'data:image/jpeg;base64,daylight-preview' },
    });

    expect((result as any).face_crop.original_image_url).toBe('data:image/jpeg;base64,daylight-preview');
  });

  it('fills original_image_url from top-level slot/photo hints with nested photos payload', () => {
    const payload = {
      face_crop: {},
      slot_id: 'indoor_white',
      photo_id: 'p_indoor',
    };

    const result = enrichPhotoModulesPayloadWithSessionPreview(
      payload,
      [{ slot_id: 'indoor_white', photo_id: 'p_indoor' }],
      {
        photos: {
          indoor_white: { preview: 'data:image/jpeg;base64,nested-indoor-preview' },
        },
      },
    );

    expect((result as any).face_crop.original_image_url).toBe('data:image/jpeg;base64,nested-indoor-preview');
  });

  it('falls back to default slot priority (daylight first)', () => {
    const payload = {
      face_crop: {},
    };

    const result = enrichPhotoModulesPayloadWithSessionPreview(payload, [], {
      daylight: { preview: 'data:image/jpeg;base64,daylight-first' },
      indoor_white: { preview: 'data:image/jpeg;base64,indoor-second' },
    });

    expect((result as any).face_crop.original_image_url).toBe('data:image/jpeg;base64,daylight-first');
  });

  it('falls back to any available preview entry when slot keys are non-standard', () => {
    const payload = {
      face_crop: {
        slot_id: 'unknown_slot',
      },
    };

    const result = enrichPhotoModulesPayloadWithSessionPreview(
      payload,
      [],
      {
        photos: {
          // backend variants may use non-standard slot buckets; fallback should still salvage preview.
          selfie: { preview: 'data:image/jpeg;base64,any-preview' },
        },
      } as any,
    );

    expect((result as any).face_crop.original_image_url).toBe('data:image/jpeg;base64,any-preview');
  });

  it('returns original payload when no session preview is available', () => {
    const payload = {
      face_crop: {
        slot_id: 'daylight',
      },
    };

    const result = enrichPhotoModulesPayloadWithSessionPreview(payload, [], {
      daylight: { preview: '' },
      indoor_white: { preview: '' },
    });

    expect(result).toBe(payload);
    expect((result as any).face_crop.original_image_url).toBeUndefined();
  });
});
