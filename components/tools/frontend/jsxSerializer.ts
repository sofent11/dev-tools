const attrNames: Record<string, string> = {
  class: 'className', for: 'htmlFor', tabindex: 'tabIndex', autofocus: 'autoFocus', autocomplete: 'autoComplete',
  readonly: 'readOnly', maxlength: 'maxLength', colspan: 'colSpan', rowspan: 'rowSpan', contenteditable: 'contentEditable',
  viewbox: 'viewBox', preserveaspectratio: 'preserveAspectRatio', 'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace',
  crossorigin: 'crossOrigin', srcset: 'srcSet', usemap: 'useMap', acceptcharset: 'acceptCharset', 'accept-charset': 'acceptCharset',
  autoplay: 'autoPlay', novalidate: 'noValidate', formaction: 'formAction', formenctype: 'formEncType', formmethod: 'formMethod',
  formnovalidate: 'formNoValidate', formtarget: 'formTarget', spellcheck: 'spellCheck', datetime: 'dateTime',
};
const booleans = new Set(['disabled', 'checked', 'required', 'readOnly', 'multiple', 'autoFocus', 'hidden', 'selected', 'controls', 'loop', 'muted', 'autoPlay', 'open', 'reversed', 'noValidate']);
const voidTags = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'col', 'embed', 'source', 'track', 'wbr']);
const camelCase = (name: string) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
export function componentIdentifier(input: string): string {
  const clean = input.trim().replace(/[^a-zA-Z0-9_$]/g, '');
  if (!clean) return 'SvgIcon';
  return /^\d/.test(clean) ? `Svg${clean}` : clean[0].toUpperCase() + clean.slice(1);
}
export function serializeAttributes(el: Element, options: { currentColor?: boolean; omit?: string[] } = {}): string[] {
  const omitted = new Set(options.omit || []);
  return Array.from(el.attributes).flatMap(attr => {
    const lower = attr.name.toLowerCase();
    if (omitted.has(lower) || lower.startsWith('on')) return [];
    const name = attrNames[lower] || (lower.startsWith('aria-') || lower.startsWith('data-') ? lower : camelCase(attr.name));
    let value = attr.value;
    if (options.currentColor && ['fill', 'stroke'].includes(lower) && !/^(none|url\(|currentColor|inherit|var\()/i.test(value.trim())) value = 'currentColor';
    if (name === 'style') {
      const style = document.createElement('div').style;
      style.cssText = value;
      const entries: Record<string, string> = {};
      for (let i = 0; i < style.length; i++) {
        const property = style.item(i);
        const key = property.startsWith('--') ? property : property.startsWith('-ms-') ? `ms${camelCase(property.slice(3)).replace(/^./, letter => letter.toUpperCase())}` : camelCase(property);
        entries[key] = style.getPropertyValue(property);
      }
      return [`style={${JSON.stringify(entries)}}`];
    }
    return [booleans.has(name) ? name : `${name}={${JSON.stringify(value)}}`];
  });
}
export function serializeJsxNode(node: Node, options: { currentColor?: boolean } = {}): string {
  if (node.nodeType === 3) return node.nodeValue ? `{${JSON.stringify(node.nodeValue)}}` : '';
  if (node.nodeType === 8) return `{/* ${(node.nodeValue || '').replace(/\*\//g, '* /')} */}`;
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.localName;
  const attrs = serializeAttributes(el, options);
  const attributeString = attrs.length ? ` ${attrs.join(' ')}` : '';
  const eventNote = Array.from(el.attributes).some(attr => attr.name.toLowerCase().startsWith('on')) ? '{/* Inline HTML event handlers require React callbacks. */}' : '';
  const element = !el.childNodes.length && (el.namespaceURI === 'http://www.w3.org/2000/svg' || voidTags.has(tag))
    ? `<${tag}${attributeString} />`
    : `<${tag}${attributeString}>${Array.from(el.childNodes).map(child => serializeJsxNode(child, options)).join('')}</${tag}>`;
  return eventNote ? `<>${eventNote}${element}</>` : element;
}
