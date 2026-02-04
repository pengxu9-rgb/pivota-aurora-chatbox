import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';

import type { ExternalVerificationCitationV1 } from '@/lib/auroraExternalVerification';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/types';

function extractPmid(value: string): string | null {
  const match = value.match(/\bPMID:\s*(\d{5,10})\b/i);
  return match?.[1] ?? null;
}

function isPubmedUrl(url: string): boolean {
  return /pubmed\.ncbi\.nlm\.nih\.gov\/\d{5,10}\/?/i.test(url);
}

function formatMeta(c: ExternalVerificationCitationV1): string {
  const parts: string[] = [];
  if (c.source) parts.push(c.source);
  if (typeof c.year === 'number' && Number.isFinite(c.year)) parts.push(String(c.year));
  if (c.note) {
    const pmid = extractPmid(c.note);
    parts.push(pmid ? `PMID:${pmid}` : c.note);
  }
  return parts.join(' · ');
}

export function AuroraReferencesCard({
  citations,
  language,
  className,
}: {
  citations: ExternalVerificationCitationV1[];
  language: Language;
  className?: string;
}) {
  const items = useMemo(() => citations.slice(0, 8), [citations]);
  if (!items.length) return null;

  return (
    <div className={cn('chat-card space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{language === 'CN' ? '参考文献' : 'Citations'}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {language === 'CN' ? '来源：PubMed（如上游提供）' : 'Source: PubMed (when provided upstream)'}
          </div>
        </div>
        <div className="rounded-full border border-border/60 bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">
          {items.length}
        </div>
      </div>

      <ol className="space-y-2">
        {items.map((c) => {
          const meta = formatMeta(c);
          const href = c.url && c.url.trim() ? c.url.trim() : null;
          const showLink = Boolean(href);

          return (
            <li key={(href || c.note || c.title).slice(0, 240)} className="rounded-xl border border-border/60 bg-background/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {showLink ? (
                    <a
                      href={href as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm font-semibold text-primary hover:underline"
                    >
                      {c.title}
                    </a>
                  ) : (
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                  )}
                  {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
                </div>

                {showLink ? (
                  <a
                    href={href as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60"
                    aria-label={language === 'CN' ? '打开链接' : 'Open link'}
                    title={language === 'CN' ? '打开链接' : 'Open link'}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>

              {href && !isPubmedUrl(href) ? (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {language === 'CN' ? '提示：该链接可能不是 PubMed。' : 'Note: this link may not be PubMed.'}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="text-[11px] text-muted-foreground">
        {language === 'CN'
          ? '仅供信息参考，不构成医疗建议。'
          : 'For informational purposes only; not medical advice.'}
      </div>
    </div>
  );
}

