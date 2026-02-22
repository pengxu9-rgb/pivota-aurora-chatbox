import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type GuardrailRule = 'hardcoded-copy' | 'dual-footer';

const PROMPT_COPY_FILES = [
  'src/components/chat/cards/DiagnosisCard.tsx',
  'src/components/chat/cards/QuickProfileFlow.tsx',
  'src/components/chat/cards/PhotoUploadCard.tsx',
  'src/components/aurora/cards/IngredientReportCard.tsx',
] as const;

const PROMPT_SURFACE_FILES = [
  'src/components/chat/cards/DiagnosisCard.tsx',
  'src/components/chat/cards/QuickProfileFlow.tsx',
  'src/components/chat/cards/PhotoUploadCard.tsx',
  'src/components/aurora/cards/IngredientReportCard.tsx',
] as const;

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function hasGuardrailIgnore(line: string, previousLine: string, rule: GuardrailRule): boolean {
  const full = `${previousLine}\n${line}`;
  return full.includes(`prompt-guardrail-ignore ${rule}`) || full.includes('prompt-guardrail-ignore all');
}

function extractBffPromptSlices(content: string): Array<{ label: string; slice: string }> {
  const routineStart = content.indexOf('open={routineSheetOpen}');
  const productStart = content.indexOf('open={productSheetOpen}');
  const profileStart = content.indexOf('open={profileSheetOpen}');
  const checkinStart = content.indexOf('open={checkinSheetOpen}');
  const errorStart = content.indexOf('{error ? (', checkinStart);

  return [
    {
      label: 'routine-sheet',
      slice: routineStart >= 0 && productStart > routineStart ? content.slice(routineStart, productStart) : '',
    },
    {
      label: 'profile-sheet',
      slice: profileStart >= 0 && checkinStart > profileStart ? content.slice(profileStart, checkinStart) : '',
    },
    {
      label: 'checkin-sheet',
      slice: checkinStart >= 0 && errorStart > checkinStart ? content.slice(checkinStart, errorStart) : '',
    },
  ];
}

describe('prompt adoption guardrails', () => {
  it('blocks prompt-like cards from reintroducing hardcoded EN copy where i18n is expected', () => {
    const violations: string[] = [];
    const disallowedLiteral =
      /['"`](Next questions|Complete profile|Skip photos|Continue without photos|Not now|Skip diagnosis|How's your|How would you|How sensitive)['"`]/i;
    const disallowedInlineBilingual = /language\s*===\s*['"]CN['"]\s*\?\s*['"`]/;

    for (const file of PROMPT_COPY_FILES) {
      const lines = readSource(file).split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const prev = index > 0 ? lines[index - 1] : '';
        if (hasGuardrailIgnore(line, prev, 'hardcoded-copy')) continue;

        if (disallowedInlineBilingual.test(line) || disallowedLiteral.test(line)) {
          violations.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      }
    }

    const bffChat = readSource('src/pages/BffChat.tsx');
    for (const { label, slice } of extractBffPromptSlices(bffChat)) {
      if (!slice) continue;

      const lines = slice.split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const prev = index > 0 ? lines[index - 1] : '';
        if (hasGuardrailIgnore(line, prev, 'hardcoded-copy')) continue;
        if (disallowedLiteral.test(line)) {
          violations.push(`src/pages/BffChat.tsx:${label}:${index + 1}: ${line.trim()}`);
        }
      }
    }

    expect(
      violations,
      [
        'Detected hardcoded prompt copy in prompt-like card files.',
        'Use t(key, language) instead.',
        'If intentional, add: // prompt-guardrail-ignore hardcoded-copy',
      ].join('\n'),
    ).toEqual([]);
  });

  it('keeps /chat chips panel priority layering (primary + tertiary skip) and avoids raw skip chips competition', () => {
    const content = readSource('src/pages/BffChat.tsx');
    const start = content.indexOf("if (item.kind === 'chips')");
    expect(start).toBeGreaterThan(-1);
    const end = content.indexOf("if (item.kind === 'offer_picker')");
    const block = content.slice(start, end > start ? end : start + 2500);

    expect(block).toContain('prioritizeChips(item.chips)');
    expect(block).toContain('data-priority="primary"');
    expect(block).toContain('data-priority="skip"');
    expect(block).toContain('prompt-tertiary-action');
    expect(block).not.toMatch(/item\.chips\.map\s*\(/);
  });

  it('detects same-level primary+skip footer reintroduction in prompt surfaces (heuristic)', () => {
    const violations: string[] = [];

    for (const file of PROMPT_SURFACE_FILES) {
      const lines = readSource(file).split('\n');
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const prev = index > 0 ? lines[index - 1] : '';
        if (!line.includes('className=') || !line.includes('gap-2')) continue;
        if (hasGuardrailIgnore(line, prev, 'dual-footer')) continue;

        const windowText = lines.slice(index, Math.min(lines.length, index + 28)).join('\n');
        const hasPrimaryLike = /(chip-button-primary|action-button-primary|prompt-primary-cta)/.test(windowText);
        const hasSkipLike = /(Skip|skip|Not now|not now|Continue without photos|continue without photos)/.test(windowText);
        if (hasPrimaryLike && hasSkipLike) {
          violations.push(`${file}:${index + 1}`);
        }
      }
    }

    const bffChat = readSource('src/pages/BffChat.tsx');
    for (const { label, slice } of extractBffPromptSlices(bffChat)) {
      if (!slice) continue;
      const hasLegacyDualFooter =
        /className="[^"]*flex[^"]*gap-2[^"]*"/.test(slice) &&
        /(action-button-primary|prompt-primary-cta)/.test(slice) &&
        /(Skip|skip|Not now|not now|Continue without photos|continue without photos|Baseline only|baseline only)/.test(slice);
      if (hasLegacyDualFooter) {
        violations.push(`src/pages/BffChat.tsx:${label}`);
      }
    }

    expect(
      violations,
      [
        'Detected possible same-level primary/skip footer pattern in prompt surfaces.',
        'Use PromptFooter primary + tertiary hierarchy.',
        'If intentional, add: // prompt-guardrail-ignore dual-footer',
      ].join('\n'),
    ).toEqual([]);
  });

  it('keeps migrated /chat sheets on PromptFooter hierarchy', () => {
    const content = readSource('src/pages/BffChat.tsx');

    const routineStart = content.indexOf('open={routineSheetOpen}');
    const profileStart = content.indexOf('open={profileSheetOpen}');
    const checkinStart = content.indexOf('open={checkinSheetOpen}');

    expect(routineStart).toBeGreaterThan(-1);
    expect(profileStart).toBeGreaterThan(-1);
    expect(checkinStart).toBeGreaterThan(-1);

    const routineSlice = content.slice(routineStart, profileStart);
    const profileSlice = content.slice(profileStart, checkinStart);
    const checkinSlice = content.slice(checkinStart, content.indexOf('{error ? (', checkinStart));

    expect(routineSlice).toContain('<PromptFooter');
    expect(profileSlice).toContain('<PromptFooter');
    expect(checkinSlice).toContain('<PromptFooter');
  });

  it('keeps prompt QA harness route development-gated', () => {
    const appSource = readSource('src/App.tsx');
    const harnessLines = appSource
      .split('\n')
      .filter((line) => line.includes('path="/qa/prompt-harness"'));

    expect(harnessLines.length).toBe(1);
    expect(harnessLines[0]).toContain('import.meta.env.DEV');
    expect(harnessLines[0]).toContain(': null');
    expect(harnessLines[0]).toContain('<PromptQAHarness />');
  });
});
