export const looksLikeProductPicksRawText = (raw: string): boolean => {
  const t = String(raw || '');
  if (!t.trim()) return false;
  const lower = t.toLowerCase();
  return (
    lower.includes('shortlist') &&
    lower.includes('profile=') &&
    /\btotal\s*\d{1,3}\s*\/\s*100\b/i.test(t)
  );
};

