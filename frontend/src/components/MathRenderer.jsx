import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

function parseSegments(text) {
  const allMatches = [];

  // Block math: $$...$$
  const blockRe = /\$\$([\s\S]+?)\$\$/g;
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    allMatches.push({ type: 'block', start: m.index, end: blockRe.lastIndex, content: m[1] });
  }

  // Inline math: $...$ — skip positions already claimed by block matches
  const inlineRe = /\$([^$\n]+?)\$/g;
  while ((m = inlineRe.exec(text)) !== null) {
    const inside = allMatches.some(b => m.index >= b.start && m.index < b.end);
    if (!inside) {
      allMatches.push({ type: 'inline', start: m.index, end: inlineRe.lastIndex, content: m[1] });
    }
  }

  allMatches.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const match of allMatches) {
    if (match.start > cursor) {
      segments.push({ type: 'text', content: text.slice(cursor, match.start) });
    }
    segments.push(match);
    cursor = match.end;
  }
  if (cursor < text.length) {
    segments.push({ type: 'text', content: text.slice(cursor) });
  }

  return segments;
}

function renderTextWithBold(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    /^\*\*[^*]+\*\*$/.test(part)
      ? <strong key={j}>{part.slice(2, -2)}</strong>
      : part
  );
}

export default function MathRenderer({ text, style, block = false }) {
  if (!text) return null;
  const str = String(text);
  const segments = parseSegments(str);

  const Tag = block ? 'div' : 'span';

  if (segments.every(s => s.type === 'text')) {
    // Respect \n line breaks
    const lines = str.split('\n');
    if (lines.length === 1) return <Tag style={style}>{renderTextWithBold(str)}</Tag>;
    return (
      <Tag style={style}>
        {lines.map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {renderTextWithBold(line)}
          </React.Fragment>
        ))}
      </Tag>
    );
  }

  return (
    <Tag style={style}>
      {segments.map((seg, i) => {
        if (seg.type === 'block') {
          return (
            <span key={i} style={{ display: 'block', overflowX: 'auto', margin: '0.85rem 0', textAlign: 'center' }}>
              <BlockMath math={seg.content} errorColor="#f87171" />
            </span>
          );
        }
        if (seg.type === 'inline') {
          return <InlineMath key={i} math={seg.content} errorColor="#f87171" />;
        }
        // Text segment: honour \n as line breaks and **bold** markers
        const lines = seg.content.split('\n');
        return (
          <span key={i}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderTextWithBold(line)}
              </React.Fragment>
            ))}
          </span>
        );
      })}
    </Tag>
  );
}
