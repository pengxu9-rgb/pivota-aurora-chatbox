const FRAGRANCE_FREE_SIGNAL_RE =
  /\b(no (added )?fragrance|fragrance[\s-]*free|without fragrance|fragrance (?:not|none) listed|no parfum|parfum[\s-]*free)\b/i;
const FRAGRANCE_FREE_SIGNAL_CN_RE = /(无香精|不含香精|未添加香精|香精(?:未添加|不含))/i;

export function filterContradictoryFragranceFlags(flags: string[]): string[] {
  const rows = Array.isArray(flags) ? flags : [];
  const hasDescriptiveFragranceFree = rows.some((flag) => {
    const text = String(flag || '').trim();
    if (!text) return false;
    if (text.toLowerCase() === 'fragrance') return false;
    return FRAGRANCE_FREE_SIGNAL_RE.test(text) || FRAGRANCE_FREE_SIGNAL_CN_RE.test(text);
  });
  if (!hasDescriptiveFragranceFree) return rows;
  return rows.filter((flag) => String(flag || '').trim().toLowerCase() !== 'fragrance');
}
