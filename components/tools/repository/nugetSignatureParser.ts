import * as asn1js from 'asn1js';
import { AttributeTypeAndValue, Certificate, ContentInfo, IssuerAndSerialNumber, SignedData, type RelativeDistinguishedNames, type SignerInfo } from 'pkijs';
import { normalizeFingerprint } from './nugetSignatureCore';

export interface CertificateDetail {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  sha1: string;
  sha256: string;
  pem: string;
  signer: boolean;
}

const MAX_SIGNATURE_BYTES = 16 * 1024 * 1024;
const MAX_CERTIFICATES = 64;
const ASN1_LIMITS = { maxDepth: 64, maxNodes: 10000, maxContentLength: MAX_SIGNATURE_BYTES };
const DN_NAMES: Record<string, string> = {
  '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST',
  '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.5': 'serialNumber',
  '1.2.840.113549.1.9.1': 'E', '0.9.2342.19200300.100.1.25': 'DC',
  '0.9.2342.19200300.100.1.1': 'UID',
};

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const fingerprint = (bytes: ArrayBuffer) => normalizeFingerprint(hex(new Uint8Array(bytes)));
const equalBytes = (left: Uint8Array, right: Uint8Array) => left.length === right.length && left.every((byte, index) => byte === right[index]);

function parseAsn1(bytes: Uint8Array, limits = ASN1_LIMITS): asn1js.AsnType {
  const decoded = asn1js.fromBER(bytes, limits);
  if (decoded.offset === -1) throw new Error(`Invalid ASN.1 data: ${decoded.result.error}`);
  if (decoded.offset !== bytes.byteLength) throw new Error('Trailing bytes after ASN.1 data');
  return decoded.result;
}

function formatDn(name: RelativeDistinguishedNames): string {
  return name.typesAndValues.map(attribute => {
    // Decode DirectoryString through ASN1js, including UTF8String and BMPString.
    const value: unknown = attribute.value.valueBlock.value;
    if (typeof value !== 'string') {
      const raw = attribute.value.valueBeforeDecodeView;
      return `${DN_NAMES[attribute.type] || attribute.type}=#${hex(raw.length ? raw : new Uint8Array(attribute.value.toBER()))}`;
    }
    const escaped = value.replace(/[,+=<>#;"\\]/g, character => `\\${character}`).replace(/\0/g, '\\00').replace(/^ | $/g, '\\ ');
    return `${DN_NAMES[attribute.type] || attribute.type}=${escaped}`;
  }).join(', ');
}

function toPem(bytes: Uint8Array): string {
  // Avoid spreading an untrusted, potentially large byte array onto the stack.
  let binary = '';
  for (let position = 0; position < bytes.length; position += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(position, position + 0x8000));
  }
  const lines = btoa(binary).match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

function subjectKeyIdentifier(certificate: Certificate): Uint8Array | null {
  const extensions = certificate.extensions?.filter(extension => extension.extnID === '2.5.29.14') || [];
  if (extensions.length !== 1) return null;
  const encoded = new Uint8Array(extensions[0].extnValue.getValue());
  const value = parseAsn1(encoded, { maxDepth: 8, maxNodes: 32, maxContentLength: 1024 });
  if (!(value instanceof asn1js.OctetString)) throw new Error('Invalid SubjectKeyIdentifier extension');
  return new Uint8Array(value.getValue());
}

function sameIssuer(left: RelativeDistinguishedNames, right: RelativeDistinguishedNames): boolean {
  // PKIjs RelativeDistinguishedNames.isEqual flattens RDN SETs. Preserve the
  // sequence of groups while comparing each SET's attributes without ordering.
  const groups = (name: RelativeDistinguishedNames): AttributeTypeAndValue[][] => {
    const sequence = parseAsn1(new Uint8Array(name.valueBeforeDecode));
    if (!(sequence instanceof asn1js.Sequence)) throw new Error('Invalid issuer name');
    return sequence.valueBlock.value.map(group => {
      if (!(group instanceof asn1js.Set)) throw new Error('Invalid issuer RDN');
      return group.valueBlock.value.map(attribute => new AttributeTypeAndValue({ schema: attribute }));
    });
  };
  const leftGroups = groups(left);
  const rightGroups = groups(right);
  return leftGroups.length === rightGroups.length && leftGroups.every((leftGroup, index) => {
    const unmatched = rightGroups[index].slice();
    if (leftGroup.length !== unmatched.length) return false;
    for (const attribute of leftGroup) {
      const match = unmatched.findIndex(candidate => attribute.isEqual(candidate));
      if (match === -1) return false;
      unmatched.splice(match, 1);
    }
    return true;
  });
}

function isSigner(certificate: Certificate, signers: SignerInfo[]): boolean {
  return signers.some(signer => {
    if (signer.sid instanceof IssuerAndSerialNumber) {
      return certificate.serialNumber.isEqual(signer.sid.serialNumber) && sameIssuer(certificate.issuer, signer.sid.issuer);
    }
    const sid: unknown = signer.sid;
    let identifier: Uint8Array | null = null;
    if (sid instanceof asn1js.Primitive && sid.idBlock.tagClass === 3 && sid.idBlock.tagNumber === 0) {
      identifier = sid.valueBlock.valueHexView;
    } else if (sid instanceof asn1js.Constructed && sid.idBlock.tagClass === 3 && sid.idBlock.tagNumber === 0) {
      const value = sid.valueBlock.value;
      if (value.length === 1 && value[0] instanceof asn1js.OctetString) identifier = new Uint8Array(value[0].getValue());
    }
    if (!identifier?.length) return false;
    const keyId = subjectKeyIdentifier(certificate);
    return keyId !== null && equalBytes(keyId, identifier);
  });
}

/** Inspect CMS metadata only; this does not verify signatures, trust, timestamps or revocation. */
export async function parseNugetSignature(bytes: Uint8Array): Promise<CertificateDetail[]> {
  if (!bytes.byteLength || bytes.byteLength > MAX_SIGNATURE_BYTES) throw new Error('Signature must contain between 1 byte and 16 MiB');
  const contentInfo = new ContentInfo({ schema: parseAsn1(bytes.slice()) });
  if (contentInfo.contentType !== ContentInfo.SIGNED_DATA) throw new Error('CMS content is not SignedData');
  const content: unknown = contentInfo.content;
  if (!(content instanceof asn1js.Sequence)) throw new Error('Invalid SignedData structure');
  const certificateSet = content.valueBlock.value.find(node => node.idBlock.tagClass === 3 && node.idBlock.tagNumber === 0);
  if (certificateSet && !(certificateSet instanceof asn1js.Constructed)) throw new Error('Invalid CMS certificate set');
  const certificateNodes = certificateSet instanceof asn1js.Constructed ? certificateSet.valueBlock.value : [];
  if (certificateNodes.length > MAX_CERTIFICATES) throw new Error('CMS contains more than 64 certificates');
  const signedData = new SignedData({ schema: content });
  const certificates = (signedData.certificates || []).filter((certificate): certificate is Certificate => certificate instanceof Certificate);
  const originalNodes = certificateNodes.filter((node): node is asn1js.Sequence => node instanceof asn1js.Sequence);
  if (certificates.length !== originalNodes.length) throw new Error('Cannot associate certificates with their original encoding');
  return Promise.all(certificates.map(async (certificate, index) => {
    // Hash and export the original complete certificate encoding, never a reconstructed schema.
    const original = new Uint8Array(originalNodes[index].valueBeforeDecodeView);
    const notBefore = certificate.notBefore.value;
    const notAfter = certificate.notAfter.value;
    if (!original.length || !Number.isFinite(notBefore.getTime()) || !Number.isFinite(notAfter.getTime())) throw new Error('Invalid X.509 certificate metadata');
    const [sha1, sha256] = await Promise.all([
      crypto.subtle.digest('SHA-1', original.slice().buffer as ArrayBuffer),
      crypto.subtle.digest('SHA-256', original.slice().buffer as ArrayBuffer),
    ]);
    return {
      subject: formatDn(certificate.subject), issuer: formatDn(certificate.issuer),
      serialNumber: hex(certificate.serialNumber.valueBlock.valueHexView),
      notBefore, notAfter, sha1: fingerprint(sha1), sha256: fingerprint(sha256),
      pem: toPem(original), signer: isSigner(certificate, signedData.signerInfos),
    };
  }));
}
