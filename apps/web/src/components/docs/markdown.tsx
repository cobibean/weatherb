import type { ReactNode } from 'react';
import Link from 'next/link';

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; href: string }
  | { type: 'autoLink'; value: string; href: string };

const tokenMatchers = [
  { type: 'link' as const, regex: /\[([^\]]+)\]\(([^)]+)\)/g },
  { type: 'autoLink' as const, regex: /(https?:\/\/[^\s)]+)/g },
  { type: 'code' as const, regex: /`([^`]+)`/g },
  { type: 'bold' as const, regex: /\*\*([^*]+)\*\*/g },
  { type: 'italic' as const, regex: /\*([^*]+)\*/g },
];

const isExternalLink = (href: string): boolean => href.startsWith('http://') || href.startsWith('https://');

const tokenizeInline = (input: string): InlineToken[] => {
  const tokens: InlineToken[] = [];
  let cursor = 0;

  while (cursor < input.length) {
    let nextMatch:
      | {
          type: typeof tokenMatchers[number]['type'];
          match: RegExpExecArray;
        }
      | undefined;

    for (const matcher of tokenMatchers) {
      matcher.regex.lastIndex = cursor;
      const match = matcher.regex.exec(input);
      if (!match) continue;
      if (!nextMatch || match.index < nextMatch.match.index) {
        nextMatch = { type: matcher.type, match };
      }
    }

    if (!nextMatch) {
      tokens.push({ type: 'text', value: input.slice(cursor) });
      break;
    }

    if (nextMatch.match.index > cursor) {
      tokens.push({
        type: 'text',
        value: input.slice(cursor, nextMatch.match.index),
      });
    }

    switch (nextMatch.type) {
      case 'link':
        tokens.push({
          type: 'link',
          value: nextMatch.match[1]!,
          href: nextMatch.match[2]!,
        });
        break;
      case 'autoLink':
        tokens.push({
          type: 'autoLink',
          value: nextMatch.match[1]!,
          href: nextMatch.match[1]!,
        });
        break;
      case 'code':
        tokens.push({ type: 'code', value: nextMatch.match[1]! });
        break;
      case 'bold':
        tokens.push({ type: 'bold', value: nextMatch.match[1]! });
        break;
      case 'italic':
        tokens.push({ type: 'italic', value: nextMatch.match[1]! });
        break;
      default:
        tokens.push({ type: 'text', value: nextMatch.match[0] });
        break;
    }

    cursor = nextMatch.match.index + nextMatch.match[0].length;
  }

  return tokens;
};

export const renderInlineMarkdown = (input: string): ReactNode[] => {
  const tokens = tokenizeInline(input);
  return tokens.map((token, index) => {
    if (token.type === 'text') return token.value;
    if (token.type === 'bold') return <strong key={`bold-${index}`}>{token.value}</strong>;
    if (token.type === 'italic') return <em key={`italic-${index}`}>{token.value}</em>;
    if (token.type === 'code') {
      return (
        <code
          key={`code-${index}`}
          className="rounded-sm bg-[#0c2134] px-1.5 py-0.5 font-mono text-sm text-[#f4f7fb]"
        >
          {token.value}
        </code>
      );
    }
    if (token.type === 'link' || token.type === 'autoLink') {
      if (isExternalLink(token.href)) {
        return (
          <a
            key={`link-${index}`}
            href={token.href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[#a6d6f2] underline decoration-sky-deep/40 underline-offset-4 hover:decoration-sky-deep"
          >
            {token.value}
          </a>
        );
      }

      return (
        <Link
          key={`link-${index}`}
          href={token.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[#a6d6f2] underline decoration-sky-deep/40 underline-offset-4 hover:decoration-sky-deep"
        >
          {token.value}
        </Link>
      );
    }
    // All token types are handled above, this should never be reached
    return null;
  });
};

export const renderMarkdownParagraphs = (markdown: string): ReactNode[] => {
  const trimmed = markdown.trim();
  if (!trimmed) return [];

  return trimmed.split(/\n\s*\n/).map((paragraph, index) => {
    const cleanParagraph = paragraph.replace(/\n+/g, ' ');
    return (
      <p key={`paragraph-${index}`} className="text-base leading-relaxed text-[#f4f7fb]">
        {renderInlineMarkdown(cleanParagraph)}
      </p>
    );
  });
};
