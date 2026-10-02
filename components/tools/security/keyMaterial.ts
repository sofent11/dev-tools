interface DerNode { tag: number; start: number; content: number; end: number }
export interface KeyMaterial { der: Uint8Array; privateKey: boolean; kind: 'RSA' | 'EC'; curve?: 'P-256' | 'P-384' | 'P-521'; bits: number }
const RSA_OID = '2a864886f70d010101';
const EC_OID = '2a8648ce3d0201';
const curves: Record<string, KeyMaterial['curve']> = { '2a8648ce3d030107': 'P-256', '2b81040022': 'P-384', '2b81040023': 'P-521' };
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
function nodeAt(bytes: Uint8Array, start: number, boundary = bytes.length): DerNode {
  if (start + 2 > boundary) throw new Error('DER 数据不完整');
  const tag = bytes[start]; let content = start + 2; let length = bytes[start + 1];
  if (length & 0x80) {
    const count = length & 0x7f;
    if (!count || count > 4 || content + count > boundary) throw new Error('DER 长度无效');
    length = 0;
    for (let i = 0; i < count; i++) length = length * 256 + bytes[content++];
  }
  const end = content + length;
  if (end > boundary || end < content) throw new Error('DER 数据不完整');
  return { tag, start, content, end };
}
function children(bytes: Uint8Array, parent: DerNode): DerNode[] {
  const result: DerNode[] = []; let position = parent.content;
  while (position < parent.end) { const next = nodeAt(bytes, position, parent.end); result.push(next); position = next.end; }
  return result;
}
const part = (bytes: Uint8Array, node: DerNode) => bytes.slice(node.start, node.end);
function sequence(bytes: Uint8Array): DerNode[] {
  const root = nodeAt(bytes, 0);
  if (root.tag !== 0x30 || root.end !== bytes.length) throw new Error('请输入完整 DER SEQUENCE');
  return children(bytes, root);
}
function tlv(tag: number, value: Uint8Array): Uint8Array {
  const length = value.length; const encoded: number[] = [];
  if (length < 128) encoded.push(length);
  else { let remaining = length; while (remaining) { encoded.unshift(remaining & 255); remaining = Math.floor(remaining / 256); } encoded.unshift(0x80 | encoded.length); }
  return Uint8Array.from([tag, ...encoded, ...value]);
}
const concat = (...values: Uint8Array[]) => Uint8Array.from(values.flatMap(value => Array.from(value)));
const oidBytes = (value: string) => Uint8Array.from(value.match(/../g)!.map(byte => parseInt(byte, 16)));
const rsaAlgorithm = tlv(0x30, concat(tlv(0x06, oidBytes(RSA_OID)), Uint8Array.of(0x05, 0)));
function integerBits(bytes: Uint8Array, value: DerNode): number {
  if (value.tag !== 0x02) throw new Error('RSA 模数无效');
  let position = value.content; while (position < value.end && bytes[position] === 0) position++;
  return position === value.end ? 0 : (value.end - position - 1) * 8 + 32 - Math.clz32(bytes[position]);
}
export function readKeyMaterial(input: Uint8Array): KeyMaterial {
  let der = input; let items = sequence(der);
  // Normalize PKCS#1 RSA and SEC1 EC into the Web Crypto containers.
  if (items[0]?.tag === 0x02 && items[1]?.tag === 0x02) {
    const privateKey = items.length > 2;
    der = privateKey ? tlv(0x30, concat(Uint8Array.of(2, 1, 0), rsaAlgorithm, tlv(0x04, der))) : tlv(0x30, concat(rsaAlgorithm, tlv(0x03, concat(Uint8Array.of(0), der))));
    items = sequence(der);
  } else if (items[0]?.tag === 0x02 && items[1]?.tag === 0x04) {
    const params = items.find(item => item.tag === 0xa0);
    if (!params) throw new Error('EC 私钥缺少 namedCurve 参数');
    const algorithm = tlv(0x30, concat(tlv(0x06, oidBytes(EC_OID)), der.slice(params.content, params.end)));
    der = tlv(0x30, concat(Uint8Array.of(2, 1, 0), algorithm, tlv(0x04, der)));
    items = sequence(der);
  }
  const privateKey = items[0]?.tag === 0x02;
  const algorithm = items[privateKey ? 1 : 0]; const payload = items[privateKey ? 2 : 1];
  if (!algorithm || algorithm.tag !== 0x30 || !payload || payload.tag !== (privateKey ? 0x04 : 0x03)) throw new Error('无法识别 PKCS#8 / SPKI 密钥结构');
  const identifiers = children(der, algorithm); const algorithmOid = identifiers[0];
  if (!algorithmOid || algorithmOid.tag !== 0x06) throw new Error('密钥缺少算法 OID');
  const id = hex(der.slice(algorithmOid.content, algorithmOid.end));
  if (id === RSA_OID) {
    if (!privateKey && der[payload.content] !== 0) throw new Error('RSA BIT STRING 无效');
    const rsa = der.slice(payload.content + (privateKey ? 0 : 1), payload.end);
    const rsaItems = sequence(rsa); const modulus = rsaItems[privateKey ? 1 : 0];
    if (!modulus) throw new Error('RSA 密钥缺少模数');
    const bits = integerBits(rsa, modulus); if (!bits) throw new Error('RSA 模数为空');
    return { der, privateKey, kind: 'RSA', bits };
  }
  if (id === EC_OID) {
    const curveOid = identifiers[1]; const curve = curveOid?.tag === 0x06 ? curves[hex(der.slice(curveOid.content, curveOid.end))] : undefined;
    if (!curve) throw new Error('仅支持 P-256、P-384、P-521 namedCurve');
    return { der, privateKey, kind: 'EC', curve, bits: Number(curve.slice(2)) };
  }
  throw new Error('仅支持 RSA 和 EC 密钥');
}
export async function importKeyMaterial(material: KeyMaterial): Promise<CryptoKey> {
  const algorithm = material.kind === 'EC' ? { name: 'ECDSA', namedCurve: material.curve! } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  return crypto.subtle.importKey(material.privateKey ? 'pkcs8' : 'spki', material.der.slice().buffer as ArrayBuffer, algorithm, true, material.privateKey ? ['sign'] : ['verify']);
}
export function certificatePublicKey(der: Uint8Array): Uint8Array {
  const certificate = sequence(der); const tbs = certificate[0];
  if (!tbs || tbs.tag !== 0x30 || certificate.length !== 3) throw new Error('X.509 证书结构无效');
  const fields = children(der, tbs); const spki = fields[fields[0]?.tag === 0xa0 ? 6 : 5];
  if (!spki || spki.tag !== 0x30) throw new Error('证书缺少 SubjectPublicKeyInfo');
  const key = part(der, spki); readKeyMaterial(key); return key;
}
export const decodePem = (pem: string): Uint8Array => {
  const match = pem.match(/^\s*-----BEGIN ([A-Z0-9 ]+)-----([\s\S]+?)-----END \1-----\s*$/);
  if (!match) throw new Error('PEM 块不完整或标签不一致');
  const binary = atob(match[2].replace(/\s/g, ''));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
};
export async function certificateMatchesPrivateKey(certificate: Uint8Array, privateDer: Uint8Array): Promise<boolean> {
  const publicMaterial = readKeyMaterial(certificatePublicKey(certificate)); const privateMaterial = readKeyMaterial(privateDer);
  if (!privateMaterial.privateKey || publicMaterial.kind !== privateMaterial.kind) return false;
  const [publicKey, privateKey] = await Promise.all([importKeyMaterial(publicMaterial), importKeyMaterial(privateMaterial)]);
  const [publicJwk, privateJwk] = await Promise.all([crypto.subtle.exportKey('jwk', publicKey), crypto.subtle.exportKey('jwk', privateKey)]);
  return publicMaterial.kind === 'RSA' ? publicJwk.n === privateJwk.n && publicJwk.e === privateJwk.e : publicJwk.crv === privateJwk.crv && publicJwk.x === privateJwk.x && publicJwk.y === privateJwk.y;
}
export function csrPublicKey(der: Uint8Array): Uint8Array {
  const request = sequence(der); const info = request[0];
  if (!info || info.tag !== 0x30 || request.length !== 3) throw new Error('PKCS#10 请求结构无效');
  const spki = children(der, info)[2];
  if (!spki || spki.tag !== 0x30) throw new Error('请求缺少 SubjectPublicKeyInfo');
  const key = part(der, spki); readKeyMaterial(key); return key;
}
