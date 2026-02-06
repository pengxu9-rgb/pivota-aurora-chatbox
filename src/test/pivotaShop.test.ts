import { describe, expect, it } from 'vitest';

import { buildPdpUrl, extractPdpTargetFromOffersResolveResponse } from '@/lib/pivotaShop';

describe('pivotaShop', () => {
  describe('extractPdpTargetFromOffersResolveResponse', () => {
    it('extracts from root product fields', () => {
      const resp = { product: { product_id: 'prod_1', merchant_id: 'merch_1' }, offers: [] };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toEqual({ product_id: 'prod_1', merchant_id: 'merch_1' });
    });

    it('extracts from offer fields', () => {
      const resp = { offers: [{ product_id: 'prod_2', merchant_id: 'merch_2' }] };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toEqual({ product_id: 'prod_2', merchant_id: 'merch_2' });
    });

    it('extracts from product_group_id', () => {
      const resp = { offers: [{ product_group_id: 'pg:merch_3:prod_3' }] };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toEqual({ product_id: 'prod_3', merchant_id: 'merch_3' });
    });

    it('extracts from offer_id', () => {
      const resp = { offers: [{ offer_id: 'of:v1:merch_4:pg:merch_4:prod_4:merchant:single' }] };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toEqual({ product_id: 'prod_4', merchant_id: 'merch_4' });
    });

    it('returns null when no target present', () => {
      const resp = { offers: [{ url: 'https://example.com' }] };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toBeNull();
    });
  });

  describe('buildPdpUrl', () => {
    it('builds URL with merchant_id and entry', () => {
      const url = buildPdpUrl({ baseUrl: 'https://agent.pivota.cc', product_id: 'prod_1', merchant_id: 'merch_1' });
      expect(url).toBe('https://agent.pivota.cc/products/prod_1?merchant_id=merch_1&entry=aurora_chatbox');
    });

    it('omits merchant_id when missing', () => {
      const url = buildPdpUrl({ baseUrl: 'https://agent.pivota.cc/', product_id: 'prod_2' });
      expect(url).toBe('https://agent.pivota.cc/products/prod_2?entry=aurora_chatbox');
    });
  });
});

