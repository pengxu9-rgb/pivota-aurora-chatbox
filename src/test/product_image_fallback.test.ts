import { describe, expect, it } from 'vitest';

import { pickProductImageUrl } from '@/lib/productImage';

describe('pickProductImageUrl', () => {
  it('returns image_url when available', () => {
    const url = pickProductImageUrl({
      image_url: 'https://example.com/main.jpg',
      image_urls: ['https://example.com/fallback.jpg'],
    });
    expect(url).toBe('https://example.com/main.jpg');
  });

  it('returns first image_urls entry when image_url is missing', () => {
    const url = pickProductImageUrl({
      image_url: null,
      image_urls: ['https://example.com/list-1.jpg', 'https://example.com/list-2.jpg'],
    });
    expect(url).toBe('https://example.com/list-1.jpg');
  });

  it('prefers https when same image is present in both schemes', () => {
    const url = pickProductImageUrl({
      image_url: 'http://example.com/asset.jpg',
      image_urls: ['https://example.com/asset.jpg'],
    });
    expect(url).toBe('https://example.com/asset.jpg');
  });

  it('returns first renderable images entry for string/object arrays', () => {
    const url = pickProductImageUrl({
      images: [{ url: '' }, { image_url: 'https://example.com/object.jpg' }, 'https://example.com/string.jpg'],
    });
    expect(url).toBe('https://example.com/object.jpg');
  });

  it('returns empty string when no image fields are renderable', () => {
    const url = pickProductImageUrl({
      image_url: null,
      image: '',
      images: [{ src: '' }],
      image_urls: [],
    });
    expect(url).toBe('');
  });
});
