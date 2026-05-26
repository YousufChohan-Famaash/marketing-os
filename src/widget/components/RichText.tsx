import { memo, type ReactNode } from 'react';
import { parseRichText, type RichTextNode } from '../utils/richText';

/**
 * Renders a markdown-light AI message. Safe by construction — all URLs pass
 * through `sanitizeUrl`. Reject paths fall back to text.
 */

interface RichTextProps {
  content: string;
  className?: string;
}

function renderNodes(nodes: RichTextNode[], keyPrefix = ''): ReactNode {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    if (node.kind === 'text') return <span key={key}>{node.value}</span>;
    if (node.kind === 'bold') {
      return (
        <strong key={key} className="font-semibold">
          {renderNodes(node.children, `${key}-`)}
        </strong>
      );
    }
    if (node.kind === 'italic') {
      return <em key={key}>{renderNodes(node.children, `${key}-`)}</em>;
    }
    // link
    return (
      <a
        key={key}
        href={node.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-famaash underline underline-offset-2 hover:opacity-80"
      >
        {renderNodes(node.children, `${key}-`)}
      </a>
    );
  });
}

export const RichText = memo(function RichText({ content, className }: RichTextProps) {
  const nodes = parseRichText(content);
  return <span className={className}>{renderNodes(nodes)}</span>;
});
