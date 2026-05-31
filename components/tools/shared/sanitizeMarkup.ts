const HTML_ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'del', 'div', 'em',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'li', 'ol', 'p',
  'pre', 's', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'th',
  'thead', 'tr', 'u', 'ul',
]);

const SVG_ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline',
  'polygon', 'text', 'tspan', 'defs', 'lineargradient', 'radialgradient',
  'stop', 'title', 'desc',
]);

const GLOBAL_ATTRS = new Set([
  'aria-label', 'aria-hidden', 'role', 'title', 'alt',
]);

const HTML_ATTRS = new Set([
  'href', 'src', 'width', 'height', 'colspan', 'rowspan', 'align',
]);

const SVG_ATTRS = new Set([
  'xmlns', 'viewbox', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'stroke',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-opacity', 'fill-opacity', 'opacity', 'transform', 'preserveaspectratio',
  'gradientunits', 'gradienttransform', 'offset', 'stop-color', 'stop-opacity',
  'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline',
]);

const CSS_ALLOWED_PROPERTIES = new Set([
  'background', 'background-color', 'border', 'border-color', 'border-radius',
  'border-width', 'color', 'display', 'font-size', 'font-weight', 'height',
  'line-height', 'margin', 'margin-bottom', 'margin-left', 'margin-right',
  'margin-top', 'max-height', 'max-width', 'min-height', 'min-width', 'opacity',
  'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top',
  'fill', 'fill-opacity', 'stroke', 'stroke-dasharray', 'stroke-linecap',
  'stroke-linejoin', 'stroke-opacity', 'stroke-width', 'text-align',
  'vertical-align', 'width',
]);

const URL_ATTRS = new Set(['href', 'src']);
const DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,[a-z0-9+/]+=*$/i;
const DROP_WITH_CONTENT_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
  'foreignobject',
]);

const normalizeUrlLikeValue = (value: string) =>
  Array.from(value)
    .filter(char => char.charCodeAt(0) > 0x1f && !/\s/u.test(char))
    .join('')
    .toLowerCase();

const isSafeUrl = (value: string, allowDataImage: boolean) => {
  const normalized = normalizeUrlLikeValue(value);
  if (!normalized) return false;
  if (normalized.startsWith('#')) return true;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return true;
  if (allowDataImage && DATA_IMAGE_PATTERN.test(normalized)) return true;
  return false;
};

const sanitizeStyle = (style: string) => style
  .split(';')
  .map(part => part.trim())
  .filter(Boolean)
  .map(part => {
    const separatorIndex = part.indexOf(':');
    if (separatorIndex <= 0) return '';
    const property = part.slice(0, separatorIndex).trim().toLowerCase();
    const value = part.slice(separatorIndex + 1).trim();
    const normalizedValue = normalizeUrlLikeValue(value);
    if (!CSS_ALLOWED_PROPERTIES.has(property)) return '';
    if (
      normalizedValue.includes('url(') ||
      normalizedValue.includes('expression(') ||
      normalizedValue.includes('javascript:') ||
      normalizedValue.includes('data:text/html')
    ) {
      return '';
    }
    return `${property}: ${value}`;
  })
  .filter(Boolean)
  .join('; ');

const sanitizeElementAttributes = (
  element: Element,
  allowedAttrs: Set<string>,
  allowDataImageUrls: boolean,
) => {
  Array.from(element.attributes).forEach(attr => {
    const name = attr.name.toLowerCase();
    const value = attr.value;

    if (name.startsWith('on') || name === 'srcdoc') {
      element.removeAttribute(attr.name);
      return;
    }

    if (name === 'style') {
      const nextStyle = sanitizeStyle(value);
      if (nextStyle) {
        element.setAttribute('style', nextStyle);
      } else {
        element.removeAttribute(attr.name);
      }
      return;
    }

    const isAllowedAttr = allowedAttrs.has(name) || GLOBAL_ATTRS.has(name);
    if (!isAllowedAttr || name.startsWith('data-') || name.includes(':')) {
      element.removeAttribute(attr.name);
      return;
    }

    if (URL_ATTRS.has(name) && !isSafeUrl(value, allowDataImageUrls)) {
      element.removeAttribute(attr.name);
    }
  });
};

const unwrapElement = (element: Element) => {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
};

const sanitizeTree = (
  root: ParentNode,
  allowedTags: Set<string>,
  allowedAttrs: Set<string>,
  allowDataImageUrls: boolean,
) => {
  Array.from(root.querySelectorAll('*')).forEach(element => {
    const tagName = element.tagName.toLowerCase();
    if (!allowedTags.has(tagName)) {
      if (DROP_WITH_CONTENT_TAGS.has(tagName)) {
        element.remove();
        return;
      }
      unwrapElement(element);
      return;
    }
    sanitizeElementAttributes(element, allowedAttrs, allowDataImageUrls);
  });
};

export const sanitizeHtmlMarkup = (html: string): string => {
  if (typeof DOMParser === 'undefined') return '';

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    sanitizeTree(doc.body, HTML_ALLOWED_TAGS, HTML_ATTRS, true);
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

    sanitizeTree(svgEl, SVG_ALLOWED_TAGS, SVG_ATTRS, false);
    if (!svgEl.parentElement && svgEl.tagName.toLowerCase() === 'svg') {
      sanitizeElementAttributes(svgEl, SVG_ATTRS, false);
    }
    return svgEl.outerHTML;
  } catch {
    return '';
  }
};
