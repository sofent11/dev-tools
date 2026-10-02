const BLOCK_TAGS = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'DL', 'DT', 'DD', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL']);
const RAW_TAGS = new Set(['PRE', 'SCRIPT', 'STYLE', 'TEXTAREA']);
const fragment = (html: string): HTMLTemplateElement => {
  if (html.length > 1_000_000) throw new Error('HTML input limit: 1 MB');
  const template = document.createElement('template');
  template.innerHTML = html;
  return template;
};
const isWhitespace = (node: Node) => node.nodeType === Node.TEXT_NODE && !node.textContent?.trim();
const canIndent = (nodes: Node[]) => nodes.every(node => isWhitespace(node) || node.nodeType === Node.COMMENT_NODE || node instanceof Element && BLOCK_TAGS.has(node.tagName));

/** Preserve mixed text and raw-text elements; indent only unambiguous block-element structure. */
export const formatHtml = (html: string): string => {
  const template = fragment(html);
  const nodes = Array.from(template.content.childNodes);
  if (!canIndent(nodes)) return template.innerHTML;
  const formatNode = (node: Node, depth: number): string => {
    const indent = '  '.repeat(depth);
    if (isWhitespace(node)) return '';
    if (!(node instanceof Element)) return indent + `<!--${node.textContent || ''}-->`;
    const children = Array.from(node.childNodes);
    if (!children.length || RAW_TAGS.has(node.tagName) || !canIndent(children)) return indent + node.outerHTML;
    const outer = node.outerHTML;
    const shell = (node.cloneNode(false) as Element).outerHTML;
    const openEnd = shell.lastIndexOf('</');
    const closeStart = outer.lastIndexOf('</');
    if (closeStart < openEnd) return indent + outer;
    const formatted = children.map(child => formatNode(child, depth + 1)).filter(Boolean);
    return `${indent}${shell.slice(0, openEnd)}\n${formatted.join('\n')}\n${indent}${outer.slice(closeStart)}`;
  };
  return nodes.map(node => formatNode(node, 0)).filter(Boolean).join('\n');
};

/** Remove block indentation only. Whitespace inside inline, pre, script, style and textarea stays intact. */
export const minifyHtml = (html: string): string => {
  const template = fragment(html);
  const walk = (parent: ParentNode) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node instanceof Element) {
        if (!RAW_TAGS.has(node.tagName)) walk(node);
      } else if (isWhitespace(node)) {
        const before = node.previousSibling;
        const after = node.nextSibling;
        const blockBefore = before instanceof Element && BLOCK_TAGS.has(before.tagName);
        const blockAfter = after instanceof Element && BLOCK_TAGS.has(after.tagName);
        if (blockBefore && blockAfter || !before && blockAfter || !after && blockBefore) node.remove();
      }
    }
  };
  walk(template.content);
  return template.innerHTML;
};
