const normalizeUrlLikeValue = (value: string) =>
  Array.from(value)
    .filter(char => char.charCodeAt(0) > 0x1f && !/\s/u.test(char))
    .join('')
    .toLowerCase();

const cleanElementAttributes = (element: Element) => {
  Array.from(element.attributes).forEach(attr => {
    const name = attr.name.toLowerCase();
    const normalizedValue = normalizeUrlLikeValue(attr.value);

    if (
      name.startsWith('on') ||
      name === 'srcdoc' ||
      normalizedValue.startsWith('javascript:') ||
      normalizedValue.includes('url(javascript:')
    ) {
      element.removeAttribute(attr.name);
    }
  });
};

export const sanitizeHtmlMarkup = (html: string): string => {
  if (typeof DOMParser === 'undefined') return '';

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, link, style, meta, base').forEach(node => node.remove());
    doc.querySelectorAll('*').forEach(cleanElementAttributes);
    return doc.body.innerHTML;
  } catch {
    return '';
  }
};

export const sanitizeSvgMarkup = (svg: string): string => {
  if (typeof DOMParser === 'undefined') return '';

  try {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl || doc.querySelector('parsererror')) return '';

    svgEl.querySelectorAll('script, foreignObject, iframe, object, embed, link, meta, base').forEach(node => node.remove());
    svgEl.querySelectorAll('*').forEach(cleanElementAttributes);
    cleanElementAttributes(svgEl);

    return svgEl.outerHTML;
  } catch {
    return '';
  }
};
