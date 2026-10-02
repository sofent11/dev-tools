/** Only rewrite whitespace between element children, preserving mixed text and xml:space. */
export const transformXml = (input: string, pretty: boolean): string => {
  if (input.length > 1024 * 1024) throw new Error('XML input limit: 1 MB');
  const doc = new DOMParser().parseFromString(input, 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) throw new Error(error.textContent || 'Invalid XML');
  const visit = (element: Element, depth: number, inheritedPreserve: boolean) => {
    const space = element.getAttribute('xml:space');
    const preserve = space === 'preserve' || (space !== 'default' && inheritedPreserve);
    for (const child of Array.from(element.children)) visit(child, depth + 1, preserve);
    if (preserve || !element.children.length || Array.from(element.childNodes).some(node =>
      node.nodeType === Node.CDATA_SECTION_NODE || (node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())))) return;
    for (const node of Array.from(element.childNodes)) if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) node.remove();
    if (pretty) {
      for (const child of Array.from(element.childNodes)) element.insertBefore(doc.createTextNode(`\n${'  '.repeat(depth + 1)}`), child);
      element.appendChild(doc.createTextNode(`\n${'  '.repeat(depth)}`));
    }
  };
  visit(doc.documentElement, 0, false);
  const declaration = input.match(/^\s*(<\?xml\s[\s\S]*?\?>)/)?.[1];
  return `${declaration ? `${declaration}${pretty ? '\n' : ''}` : ''}${new XMLSerializer().serializeToString(doc)}`;
};
