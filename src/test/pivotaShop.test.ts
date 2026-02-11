import { describe, expect, it } from 'vitest';

import {
  buildProductsSearchUrl,
  buildPdpUrl,
  extractPdpTargetFromOffersResolveResponse,
  extractPdpTargetFromProductsResolveResponse,
  extractPdpTargetFromProductsSearchResponse,
} from '@/lib/pivotaShop';

describe('pivotaShop', () => {
  describe('extractPdpTargetFromOffersResolveResponse', () => {
    it('extracts from canonical_product_ref', () => {
      const resp = { status: 'success', canonical_product_ref: { product_id: 'prod_canon', merchant_id: 'merch_canon' } };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toEqual({ product_id: 'prod_canon', merchant_id: 'merch_canon' });
    });

    it('extracts from mapping.candidates product_ref', () => {
      const resp = {
        status: 'success',
        mapping: {
          candidates: [
            { score: 0.91, product_ref: { product_id: 'prod_map', merchant_id: 'merch_map' } },
          ],
        },
      };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toEqual({ product_id: 'prod_map', merchant_id: 'merch_map' });
    });

    it('extracts from members canonical refs', () => {
      const resp = {
        status: 'success',
        members: [
          { canonical_product_ref: { product_id: 'prod_member', merchant_id: 'merch_member' } },
        ],
      };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toEqual({ product_id: 'prod_member', merchant_id: 'merch_member' });
    });

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

    it('extracts merchant.id + product.id', () => {
      const resp = { product: { id: 'prod_5', merchant: { id: 'merch_5' } }, offers: [] };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toEqual({ product_id: 'prod_5', merchant_id: 'merch_5' });
    });

    it('extracts from offer.product + offer.merchant', () => {
      const resp = { offers: [{ product: { id: 'prod_6' }, merchant: { id: 'merch_6' } }] };
      expect(extractPdpTargetFromOffersResolveResponse(resp)).toEqual({ product_id: 'prod_6', merchant_id: 'merch_6' });
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

  describe('buildProductsSearchUrl', () => {
    it('builds products search URL with entry', () => {
      const url = buildProductsSearchUrl({ baseUrl: 'https://agent.pivota.cc', query: 'The Ordinary Niacinamide 10% + Zinc 1%' });
      expect(url).toBe(
        'https://agent.pivota.cc/products?q=The+Ordinary+Niacinamide+10%25+%2B+Zinc+1%25&entry=aurora_chatbox',
      );
    });

    it('returns null for empty query', () => {
      expect(buildProductsSearchUrl({ baseUrl: 'https://agent.pivota.cc', query: '   ' })).toBeNull();
    });
  });

  describe('extractPdpTargetFromProductsSearchResponse', () => {
    it('extracts from products[] (root)', () => {
      const resp = { products: [{ product_id: 'prod_1', merchant_id: 'merch_1' }] };
      expect(extractPdpTargetFromProductsSearchResponse(resp)).toEqual({ product_id: 'prod_1', merchant_id: 'merch_1' });
    });

    it('extracts from data.products[]', () => {
      const resp = { data: { products: [{ id: 'prod_2', merchant: { id: 'merch_2' } }] } };
      expect(extractPdpTargetFromProductsSearchResponse(resp)).toEqual({ product_id: 'prod_2', merchant_id: 'merch_2' });
    });

    it('prefers brand match when provided', () => {
      const resp = {
        products: [
          { product_id: 'prod_a', merchant_id: 'merch_a', brand: 'Other' },
          { product_id: 'prod_b', merchant_id: 'merch_b', brand: 'The Ordinary' },
        ],
      };
      expect(extractPdpTargetFromProductsSearchResponse(resp, { prefer_brand: 'the ordinary' })).toEqual({
        product_id: 'prod_b',
        merchant_id: 'merch_b',
      });
    });

    it('returns null when empty', () => {
      expect(extractPdpTargetFromProductsSearchResponse({ products: [] })).toBeNull();
    });
  });

  describe('extractPdpTargetFromProductsResolveResponse', () => {
    it('extracts from product_ref', () => {
      const resp = { resolved: true, product_ref: { product_id: 'prod_1', merchant_id: 'merch_1' } };
      expect(extractPdpTargetFromProductsResolveResponse(resp)).toEqual({ product_id: 'prod_1', merchant_id: 'merch_1' });
    });

    it('extracts from productRef', () => {
      const resp = { resolved: true, productRef: { productId: 'prod_2', merchantId: 'merch_2' } };
      expect(extractPdpTargetFromProductsResolveResponse(resp)).toEqual({ product_id: 'prod_2', merchant_id: 'merch_2' });
    });

    it('returns null when missing product id', () => {
      const resp = { resolved: false, product_ref: null };
      expect(extractPdpTargetFromProductsResolveResponse(resp)).toBeNull();
    });

    it('ignores unresolved opaque root product_id echoes', () => {
      const resp = {
        resolved: false,
        product_id: 'c231aaaa-8b00-4145-a704-684931049303',
        merchant_id: 'merch_efbc46b4619cfbdf',
      };
      expect(extractPdpTargetFromProductsResolveResponse(resp)).toBeNull();
    });

    it('accepts resolved non-opaque root product_id for compatibility', () => {
      const resp = {
        resolved: true,
        product_id: '9886499864904',
        merchant_id: 'merch_efbc46b4619cfbdf',
      };
      expect(extractPdpTargetFromProductsResolveResponse(resp)).toEqual({
        product_id: '9886499864904',
        merchant_id: 'merch_efbc46b4619cfbdf',
      });
    });
  });
});
