import { describe, expect, it } from 'vitest';

import {
  augmentEnvelopeWithIngredientReport,
  buildIngredientReportCard,
} from '@/lib/ingredientReportCard';
import type { V1Envelope } from '@/lib/pivotaAgentBff';

function makeBaseEnvelope(structuredPayload: Record<string, unknown>): V1Envelope {
  return {
    request_id: 'req_1',
    trace_id: 'trace_1',
    assistant_message: {
      role: 'assistant',
      content: 'Long science answer with citations list that should be replaced.',
      format: 'markdown',
    },
    suggested_chips: [],
    cards: [
      {
        card_id: 'structured_1',
        type: 'aurora_structured',
        payload: structuredPayload,
      },
    ],
    session_patch: {},
    events: [],
  };
}

describe('ingredient report card builder', () => {
  it('Case1: uses matching research profile when target INCI exists', () => {
    const structured = {
      schema_version: 'aurora.structured.v1',
      parse: {
        normalized_query: 'Analyze ingredient "Palmitoyl Tripeptide-38" for anti-aging.',
        normalized_query_language: 'en-US',
      },
      ingredient_research_profiles: [
        {
          ingredient_id: 'ing_pt38',
          inci_name: 'Palmitoyl Tripeptide-38',
          evidence_grade: 'B',
          primary_benefits: ['Fine lines', 'Firmness', 'Texture smoothing'],
          key_watchouts: ['Mild irritation in highly sensitive skin'],
        },
      ],
      ingredient_search: {
        hits: [
          {
            product_id: 'p_exact_1',
            display_name: 'Peptide Serum A',
            matched_terms: ['Palmitoyl Tripeptide-38', 'peptide'],
            score: 0.96,
          },
          {
            product_id: 'p_cat_1',
            display_name: 'Peptide Cream B',
            matched_terms: ['peptide'],
            score: 0.88,
          },
        ],
      },
      external_verification: {
        citations: [
          {
            title: 'Topical Palmitoyl Tripeptide-38 improves wrinkle appearance in facial skin.',
            source: 'Cosmetic Dermatology',
            year: 2022,
            url: 'https://pubmed.ncbi.nlm.nih.gov/19570099/',
          },
          {
            title: 'Peptide-containing topical products and signs of skin aging: a review.',
            source: 'Dermatology Review',
            year: 2021,
            url: 'https://pubmed.ncbi.nlm.nih.gov/40193112/',
          },
        ],
      },
    };

    const card = buildIngredientReportCard(makeBaseEnvelope(structured));
    expect(card).toBeTruthy();
    expect(card?.type).toBe('aurora_ingredient_report');
    expect(card?.payload.schema_version).toBe('aurora.ingredient_report.v1');
    expect(card?.payload.ingredient.inci).toBe('Palmitoyl Tripeptide-38');
    expect(card?.payload.verdict.evidence_grade).toBe('B');
    expect(card?.payload.benefits.length).toBeGreaterThan(0);
    expect(card?.payload.use_cases[0]?.products_from_kb[0]).toBe('p_exact_1');

    const enhanced = augmentEnvelopeWithIngredientReport(makeBaseEnvelope(structured));
    expect(enhanced.cards.some((c) => c.type === 'aurora_ingredient_report')).toBe(true);
    expect(enhanced.assistant_message?.content.toLowerCase()).toContain('1-minute report');
  });

  it('Case2: falls back conservatively when target profile is missing', () => {
    const structured = {
      schema_version: 'aurora.structured.v1',
      parse: {
        normalized_query: 'Analyze ingredient "Palmitoyl Tripeptide-38" for sensitivity.',
        normalized_query_language: 'en-US',
      },
      ingredient_research_profiles: [
        {
          ingredient_id: 'ing_other',
          inci_name: 'Palmitoyl Tetrapeptide-7',
          evidence_grade: 'A',
          primary_benefits: ['Redness'],
          key_watchouts: ['Irritation'],
        },
      ],
      ingredient_search: { hits: [] },
      external_verification: { citations: [] },
    };

    const card = buildIngredientReportCard(makeBaseEnvelope(structured));
    expect(card).toBeTruthy();
    expect(card?.payload.verdict.evidence_grade).toBe('unknown');
    expect(card?.payload.evidence.summary).toContain('Ingredient-specific evidence is missing');
    expect(card?.payload.benefits.every((item) => item.strength >= 1 && item.strength <= 2)).toBe(true);
    expect(card?.payload.verdict.time_to_results).toBe('unknown');
  });

  it('Case3: marks retinol/antimicrobial mixed citations as weak and hides them by default', () => {
    const structured = {
      schema_version: 'aurora.structured.v1',
      parse: {
        normalized_query: 'Analyze ingredient "Palmitoyl Tripeptide-38".',
        normalized_query_language: 'en-US',
      },
      ingredient_research_profiles: [],
      ingredient_search: { hits: [] },
      external_verification: {
        citations: [
          {
            title: 'Palmitoyl Tripeptide-38 and wrinkle depth in photoaged skin.',
            source: 'Derm Journal',
            year: 2020,
            url: 'https://pubmed.ncbi.nlm.nih.gov/19570099/',
          },
          {
            title: 'Peptide interventions in skin aging: systematic review.',
            source: 'Skin Review',
            year: 2019,
            url: 'https://pubmed.ncbi.nlm.nih.gov/40193112/',
          },
          {
            title: 'Retinol in acne management and epidermal turnover.',
            source: 'Acne Journal',
            year: 2021,
            url: 'https://pubmed.ncbi.nlm.nih.gov/32697858/',
          },
          {
            title: 'Antimicrobial peptides against wound pathogens.',
            source: 'Microbiology',
            year: 2018,
            url: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
          },
        ],
      },
    };

    const card = buildIngredientReportCard(makeBaseEnvelope(structured));
    expect(card).toBeTruthy();
    const citations = card?.payload.evidence.citations ?? [];
    expect(citations.length).toBe(2);
    expect(citations.every((item) => item.relevance === 'strong' || item.relevance === 'category')).toBe(true);
    expect(citations.some((item) => item.title.toLowerCase().includes('retinol'))).toBe(false);
    expect(citations.some((item) => item.title.toLowerCase().includes('antimicrobial'))).toBe(false);
  });

  it('Case4: prioritizes exact matched_terms hits, then falls back to category hits', () => {
    const structuredExact = {
      schema_version: 'aurora.structured.v1',
      parse: {
        normalized_query: 'Analyze ingredient "Palmitoyl Tripeptide-38".',
        normalized_query_language: 'en-US',
      },
      ingredient_research_profiles: [],
      ingredient_search: {
        hits: [
          {
            product_id: 'p_generic_high',
            display_name: 'High score generic peptide',
            matched_terms: ['peptide'],
            score: 0.97,
          },
          {
            product_id: 'p_exact_mid',
            display_name: 'Exact match serum',
            matched_terms: ['Palmitoyl Tripeptide-38'],
            score: 0.91,
          },
        ],
      },
      external_verification: { citations: [] },
    };

    const exactCard = buildIngredientReportCard(makeBaseEnvelope(structuredExact));
    const exactProducts = exactCard?.payload.use_cases[0]?.products_from_kb ?? [];
    expect(exactProducts[0]).toBe('p_exact_mid');

    const structuredNoExact = {
      schema_version: 'aurora.structured.v1',
      parse: {
        normalized_query: 'Analyze ingredient "Palmitoyl Tripeptide-38".',
        normalized_query_language: 'en-US',
      },
      ingredient_research_profiles: [],
      ingredient_search: {
        hits: [
          {
            product_id: 'p_pep_1',
            display_name: 'Peptide option 1',
            matched_terms: ['peptide'],
            score: 0.85,
          },
          {
            product_id: 'p_pep_2',
            display_name: 'Peptide option 2',
            matched_terms: ['peptide complex'],
            score: 0.82,
          },
        ],
      },
      external_verification: { citations: [] },
    };

    const noExactCard = buildIngredientReportCard(makeBaseEnvelope(structuredNoExact));
    const fallbackProducts = noExactCard?.payload.use_cases[0]?.products_from_kb ?? [];
    expect(fallbackProducts[0]).toBe('p_pep_1');
    expect(fallbackProducts).toContain('p_pep_2');
  });

  it('Case5: evidence citations must be sourced from external_verification.citations only', () => {
    const inputUrls = [
      'https://pubmed.ncbi.nlm.nih.gov/19570099/',
      'https://pubmed.ncbi.nlm.nih.gov/40193112/',
      'https://pubmed.ncbi.nlm.nih.gov/32697858/',
    ];

    const structured = {
      schema_version: 'aurora.structured.v1',
      parse: {
        normalized_query: 'Analyze ingredient "Palmitoyl Tripeptide-38".',
        normalized_query_language: 'en-US',
      },
      ingredient_research_profiles: [],
      ingredient_search: { hits: [] },
      external_verification: {
        citations: [
          {
            title: 'Role of topical peptides in preventing or treating aged skin.',
            source: 'International journal of cosmetic science',
            year: 2009,
            url: inputUrls[0],
          },
          {
            title: 'OS-01 Peptide Topical Formulation Improves Skin Barrier Function and Reduces Systemic Inflammation Markers: A Pilot 12-Week Clinical Trial.',
            source: 'Journal of cosmetic dermatology',
            year: 2025,
            url: inputUrls[1],
          },
          {
            title: 'Topical application of autophagy-activating peptide improved skin barrier function and reduced acne symptoms in acne-prone skin.',
            source: 'Journal of cosmetic dermatology',
            year: 2021,
            url: inputUrls[2],
          },
        ],
      },
    };

    const card = buildIngredientReportCard(makeBaseEnvelope(structured));
    expect(card).toBeTruthy();

    const urlSet = new Set(inputUrls);
    const outputUrls = (card?.payload.evidence.citations ?? []).map((item) => item.url).filter(Boolean);

    expect(outputUrls.length).toBeGreaterThan(0);
    expect(outputUrls.every((url) => urlSet.has(url))).toBe(true);
  });

  it('Case6: products_from_kb must be a subset of ingredient_search.hits.product_id', () => {
    const hits = [
      {
        product_id: 'c2999192-93f9-4163-9663-476f1b54a716',
        display_name: 'Peptide Serum A',
        matched_terms: ['Palmitoyl Tripeptide-38'],
        score: 0.95,
      },
      {
        product_id: '5d5291af-b292-428e-ba67-c6b5c70a2e2a',
        display_name: 'Peptide Cream B',
        matched_terms: ['peptide'],
        score: 0.89,
      },
      {
        product_id: '3b427351-589f-4e6a-aac4-0b31258f2eeb',
        display_name: 'Peptide Gel C',
        matched_terms: ['peptide complex'],
        score: 0.84,
      },
    ];

    const structured = {
      schema_version: 'aurora.structured.v1',
      parse: {
        normalized_query: 'Analyze ingredient "Palmitoyl Tripeptide-38".',
        normalized_query_language: 'en-US',
      },
      ingredient_research_profiles: [],
      ingredient_search: { hits },
      external_verification: { citations: [] },
    };

    const card = buildIngredientReportCard(makeBaseEnvelope(structured));
    expect(card).toBeTruthy();

    const hitIdSet = new Set(hits.map((item) => item.product_id));
    const productIds = card?.payload.use_cases[0]?.products_from_kb ?? [];

    expect(productIds.length).toBeGreaterThan(0);
    expect(productIds.every((id) => hitIdSet.has(id))).toBe(true);
  });
});
