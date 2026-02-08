import React from 'react';

import { cn } from '@/lib/utils';

type ChatRichTextRole = 'user' | 'assistant';

type ChatRichTextProps = {
  text: string;
  role?: ChatRichTextRole;
  className?: string;
};

type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string; level: number }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'divider' }
  | { kind: 'code'; code: string; language?: string };

type InlineToken =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; value: string };

const CODE_FENCE_RE = /^\s*```([A-Za-z0-9_+-]+)?\s*$/;
const UL_RE = /^\s*[-*•]\s+(.+)$/;
const OL_RE = /^\s*\d+[.)]\s+(.+)$/;
const HEADING_RE = /^\s*(#{1,4})\s+(.+)$/;
const QUOTE_RE = /^\s*>\s?(.+)$/;
const DIVIDER_RE = /^\s*(?:---+|\*\*\*+|___+)\s*$/;

const INLINE_CODE_RE = /`([^`\n]+)`/g;
const INLINE_STRONG_RE = /\*\*([^*]+)\*\*|__([^_]+)__/g;
const INLINE_URL_RE = /https?:\/\/[^\s<>()]+(?:\([^\s<>()]*\)[^\s<>()]*)*/g;

const splitTextTokens = (
  tokens: InlineToken[],
  pattern: RegExp,
  mapMatch: (match: RegExpMatchArray) => InlineToken,
): InlineToken[] => {
  const out: InlineToken[] = [];

  for (const token of tokens) {
    if (token.kind !== 'text') {
      out.push(token);
      continue;
    }

    const source = token.value;
    let last = 0;
    const matches = Array.from(source.matchAll(pattern));

    if (!matches.length) {
      out.push(token);
      continue;
    }

    for (const match of matches) {
      const full = match[0];
      if (!full) continue;
      const idx = match.index ?? 0;
      if (idx > last) out.push({ kind: 'text', value: source.slice(last, idx) });
      out.push(mapMatch(match));
      last = idx + full.length;
    }

    if (last < source.length) out.push({ kind: 'text', value: source.slice(last) });
  }

  return out;
};

const stripTrailingPunctuation = (url: string): { url: string; trailing: string } => {
  let next = url;
  let trailing = '';
  while (/[.,!?;:]$/.test(next)) {
    trailing = next.slice(-1) + trailing;
    next = next.slice(0, -1);
  }
  return { url: next, trailing };
};

const tokenizeInline = (text: string): InlineToken[] => {
  let tokens: InlineToken[] = [{ kind: 'text', value: text }];

  tokens = splitTextTokens(tokens, INLINE_CODE_RE, (match) => ({ kind: 'code', value: String(match[1] || '') }));
  tokens = splitTextTokens(tokens, INLINE_STRONG_RE, (match) => ({ kind: 'strong', value: String(match[1] || match[2] || '') }));
  tokens = splitTextTokens(tokens, INLINE_URL_RE, (match) => ({ kind: 'link', value: match[0] || '' }));

  const normalized: InlineToken[] = [];
  for (const token of tokens) {
    if (token.kind !== 'link') {
      normalized.push(token);
      continue;
    }
    const { url, trailing } = stripTrailingPunctuation(token.value);
    if (url) normalized.push({ kind: 'link', value: url });
    if (trailing) normalized.push({ kind: 'text', value: trailing });
  }

  return normalized;
};

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) nodes.push(<br key={`${keyPrefix}_br_${lineIndex}`} />);
    const tokens = tokenizeInline(line);
    tokens.forEach((token, tokenIndex) => {
      const key = `${keyPrefix}_${lineIndex}_${tokenIndex}`;
      if (token.kind === 'strong') {
        nodes.push(
          <strong key={key} className="font-semibold tracking-[-0.01em]">
            {token.value}
          </strong>,
        );
        return;
      }
      if (token.kind === 'code') {
        nodes.push(
          <code key={key} className="chat-inline-code">
            {token.value}
          </code>,
        );
        return;
      }
      if (token.kind === 'link') {
        nodes.push(
          <a key={key} className="chat-inline-link" href={token.value} target="_blank" rel="noreferrer">
            {token.value}
          </a>,
        );
        return;
      }
      nodes.push(<React.Fragment key={key}>{token.value}</React.Fragment>);
    });
  });

  return nodes;
};

const parseBlocks = (text: string): Block[] => {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i] ?? '';
    const trimmed = current.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    const fence = current.match(CODE_FENCE_RE);
    if (fence) {
      const lang = String(fence[1] || '').trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !CODE_FENCE_RE.test(lines[i] || '')) {
        body.push(lines[i] || '');
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ kind: 'code', code: body.join('\n').trimEnd(), language: lang || undefined });
      continue;
    }

    if (DIVIDER_RE.test(current)) {
      blocks.push({ kind: 'divider' });
      i += 1;
      continue;
    }

    if (QUOTE_RE.test(current)) {
      const linesInQuote: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i] || '')) {
        const match = (lines[i] || '').match(QUOTE_RE);
        if (match?.[1]) linesInQuote.push(match[1].trim());
        i += 1;
      }
      if (linesInQuote.length) {
        blocks.push({ kind: 'quote', text: linesInQuote.join('\n').trim() });
      }
      continue;
    }

    if (UL_RE.test(current)) {
      const items: string[] = [];
      while (i < lines.length && UL_RE.test(lines[i] || '')) {
        const match = (lines[i] || '').match(UL_RE);
        if (match?.[1]) items.push(match[1].trim());
        i += 1;
      }
      if (items.length) blocks.push({ kind: 'ul', items });
      continue;
    }

    if (OL_RE.test(current)) {
      const items: string[] = [];
      while (i < lines.length && OL_RE.test(lines[i] || '')) {
        const match = (lines[i] || '').match(OL_RE);
        if (match?.[1]) items.push(match[1].trim());
        i += 1;
      }
      if (items.length) blocks.push({ kind: 'ol', items });
      continue;
    }

    const heading = current.match(HEADING_RE);
    if (heading?.[2]) {
      blocks.push({ kind: 'heading', level: Math.min(4, heading[1]?.length || 1), text: heading[2].trim() });
      i += 1;
      continue;
    }

    const paragraph: string[] = [current];
    i += 1;
    while (i < lines.length) {
      const peek = lines[i] || '';
      if (!peek.trim()) break;
      if (CODE_FENCE_RE.test(peek) || UL_RE.test(peek) || OL_RE.test(peek) || HEADING_RE.test(peek)) break;
      if (QUOTE_RE.test(peek) || DIVIDER_RE.test(peek)) break;
      paragraph.push(peek);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraph.join('\n').trim() });
  }

  return blocks;
};

export function ChatRichText({ text, role = 'assistant', className }: ChatRichTextProps) {
  const blocks = parseBlocks(String(text || ''));

  return (
    <div className={cn('chat-rich-text', role === 'user' ? 'chat-rich-text-user' : 'chat-rich-text-assistant', className)}>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <h4 key={`h_${index}`} className={cn('chat-rich-heading', block.level <= 1 ? 'chat-rich-heading-lg' : '')}>
              {renderInline(block.text, `h_${index}`)}
            </h4>
          );
        }

        if (block.kind === 'ul') {
          return (
            <ul key={`ul_${index}`} className="chat-rich-list chat-rich-list-ul">
              {block.items.map((item, itemIndex) => (
                <li key={`ul_${index}_${itemIndex}`}>{renderInline(item, `ul_${index}_${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        if (block.kind === 'ol') {
          return (
            <ol key={`ol_${index}`} className="chat-rich-list chat-rich-list-ol">
              {block.items.map((item, itemIndex) => (
                <li key={`ol_${index}_${itemIndex}`}>{renderInline(item, `ol_${index}_${itemIndex}`)}</li>
              ))}
            </ol>
          );
        }

        if (block.kind === 'code') {
          return (
            <div key={`code_${index}`} className="chat-code-block-wrap">
              {block.language ? <div className="chat-code-lang">{block.language}</div> : null}
              <pre className="chat-code-block">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        if (block.kind === 'quote') {
          return (
            <blockquote key={`quote_${index}`} className="chat-rich-quote">
              {renderInline(block.text, `quote_${index}`)}
            </blockquote>
          );
        }

        if (block.kind === 'divider') {
          return <hr key={`hr_${index}`} className="chat-rich-divider" />;
        }

        return (
          <p key={`p_${index}`} className="chat-rich-paragraph">
            {renderInline(block.text, `p_${index}`)}
          </p>
        );
      })}
    </div>
  );
}
