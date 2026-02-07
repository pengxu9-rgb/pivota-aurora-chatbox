import type { Language } from '@/lib/types';

const KB_TOKEN_LABELS: Record<string, { EN: string; CN: string }> = {
  high_irritation: {
    EN: 'Higher irritation risk (may sting/peel)',
    CN: '刺激性偏高（可能刺痛/爆皮）',
  },
  strong_acid: {
    EN: 'Strong acid exfoliant (higher irritation risk)',
    CN: '强酸类去角质（更易刺激）',
  },
  mild_acid: {
    EN: 'Mild acid (introduce slowly)',
    CN: '温和酸类（仍需循序渐进）',
  },
  acid: {
    EN: 'Contains acids (SPF + frequency matters)',
    CN: '含酸类活性（注意防晒/频率）',
  },
  fragrance: {
    EN: 'May contain fragrance (watch if sensitive)',
    CN: '可能含香精/香料（敏感肌留意）',
  },
  fungal_acne: {
    EN: 'Fungal acne flag (FYI)',
    CN: '真菌痘风险提示（仅供参考）',
  },
  pill: {
    EN: 'May pill with some layers',
    CN: '可能搓泥（叠加不当时）',
  },
  minimalist: {
    EN: 'Minimalist formula (layering-friendly)',
    CN: '配方精简（叠加更友好）',
  },
};

function uniqCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function humanizeKbToken(raw: string, language: Language): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  const label = KB_TOKEN_LABELS[lower]?.[language];
  return label ?? text;
}

export function humanizeKbNote(raw: string, language: Language): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';

  if (text.includes('|')) {
    const parts = text
      .split('|')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => humanizeKbToken(p, language))
      .filter(Boolean);
    return uniqCaseInsensitive(parts).join(language === 'CN' ? ' · ' : ' · ');
  }

  return humanizeKbToken(text, language);
}

