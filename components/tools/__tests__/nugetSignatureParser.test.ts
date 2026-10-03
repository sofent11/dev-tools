// @vitest-environment node
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as asn1js from 'asn1js';
import { AlgorithmIdentifier, AttributeTypeAndValue, Certificate, ContentInfo, EncapsulatedContentInfo, Extension, IssuerAndSerialNumber, RelativeDistinguishedNames, SignedData, SignerInfo, Time } from 'pkijs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseNugetSignature } from '../repository/nugetSignatureParser';

beforeAll(() => vi.stubGlobal('crypto', webcrypto));
afterAll(() => vi.unstubAllGlobals());

const fixtureCertificate = new Uint8Array(readFileSync('tests/fixtures/nuget-test-certificate.der'));
const fixtureSignature = new Uint8Array(readFileSync('tests/fixtures/nuget-signed-data.p7s'));
const encoded = (value: asn1js.AsnType) => new Uint8Array(value.toBER());
const hash = (algorithm: string, bytes: Uint8Array) => createHash(algorithm).update(bytes).digest('hex').toUpperCase().match(/../g)!.join(':');
const pemBytes = (pem: string) => new Uint8Array(Buffer.from(pem.replace(/-----[^\n]+-----|\s/g, ''), 'base64'));
const name = (value: string, bmp = false) => new RelativeDistinguishedNames({ typesAndValues: [new AttributeTypeAndValue({ type: '2.5.4.3', value: bmp ? new asn1js.BmpString({ value }) : new asn1js.Utf8String({ value }) })] });
const groupedName = (groups: [string, string][][]) => {
  const schema = new asn1js.Sequence({ value: groups.map(group => new asn1js.Set({ value: group.map(([type, value]) => new AttributeTypeAndValue({ type, value: new asn1js.Utf8String({ value }) }).toSchema()) })) });
  return new RelativeDistinguishedNames({ schema: asn1js.fromBER(encoded(schema)).result });
};

function certificate(issuer = 'Fixture issuer', subject = 'Fixture certificate', options: { bmp?: boolean; version?: number; ski?: Uint8Array } = {}): Certificate {
  // Reuse an actual OpenSSL certificate's public key/container. Tests change metadata
  // without re-signing because this utility intentionally does not verify signatures.
  const result = new Certificate({ schema: asn1js.fromBER(fixtureCertificate).result });
  result.issuer = name(issuer, options.bmp);
  result.subject = name(subject, options.bmp);
  result.version = options.version ?? 2;
  if (!result.version) delete result.extensions;
  if (options.ski) {
    result.extensions = [new Extension({ extnID: '2.5.29.14', extnValue: new asn1js.OctetString({ valueHex: options.ski }).toBER() })];
  }
  return result;
}

const signer = (value: Certificate, sid: IssuerAndSerialNumber | asn1js.Primitive | asn1js.Constructed = new IssuerAndSerialNumber({ issuer: value.issuer, serialNumber: value.serialNumber })) => new SignerInfo({
  version: sid instanceof IssuerAndSerialNumber ? 1 : 3, sid,
  digestAlgorithm: new AlgorithmIdentifier({ algorithmId: '2.16.840.1.101.3.4.2.1' }),
  signatureAlgorithm: new AlgorithmIdentifier({ algorithmId: '1.2.840.113549.1.1.1', algorithmParams: new asn1js.Null() }),
  signature: new asn1js.OctetString({ valueHex: Uint8Array.of(1) }),
});

function container(certificates: Certificate[], signers: SignerInfo[] = [signer(certificates[0])]): Uint8Array {
  for (const certificate of certificates) certificate.tbsView = new Uint8Array(certificate.encodeTBS().toBER());
  const data = new SignedData({ certificates, signerInfos: signers, encapContentInfo: new EncapsulatedContentInfo({ eContentType: ContentInfo.DATA }) });
  return encoded(new ContentInfo({ contentType: ContentInfo.SIGNED_DATA, content: data.toSchema() }).toSchema());
}

function tlv(tag: number, pieces: Uint8Array[]): Uint8Array {
  const content = Uint8Array.from(pieces.flatMap(piece => Array.from(piece)));
  const lengthBytes: number[] = [];
  let length = content.length;
  if (length < 128) lengthBytes.push(length);
  else {
    while (length) { lengthBytes.unshift(length & 255); length = Math.floor(length / 256); }
    lengthBytes.unshift(0x80 | lengthBytes.length);
  }
  return Uint8Array.from([tag, ...lengthBytes, ...content]);
}

function rawCertificateContainer(raw: Uint8Array, source: Certificate): Uint8Array {
  const data = new SignedData({ signerInfos: [signer(source)], encapContentInfo: new EncapsulatedContentInfo({ eContentType: ContentInfo.DATA }) });
  const fields = data.toSchema().valueBlock.value.map(encoded);
  const signedData = tlv(0x30, [...fields.slice(0, 3), tlv(0xa0, [raw]), fields[3]]);
  return tlv(0x30, [encoded(new asn1js.ObjectIdentifier({ value: ContentInfo.SIGNED_DATA })), tlv(0xa0, [signedData])]);
}

describe('NuGet CMS certificate metadata', () => {
  it('parses a real OpenSSL CMS fixture, preserving certificate bytes and public metadata', async () => {
    const result = await parseNugetSignature(fixtureSignature);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ subject: 'CN=Fixture certificate', issuer: 'CN=Fixture issuer', serialNumber: '01', signer: true });
    expect(result[0].notBefore.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(result[0].notAfter.toISOString()).toBe('2030-01-01T00:00:00.000Z');
    expect(result[0].sha1).toBe(hash('sha1', fixtureCertificate));
    expect(result[0].sha256).toBe(hash('sha256', fixtureCertificate));
    expect(pemBytes(result[0].pem)).toEqual(fixtureCertificate);
    expect(result[0].pem.split('\n').slice(1, -2).every(line => line.length <= 64)).toBe(true);
  });

  it('marks only the certificate with the same issuer AND serial, independent of order', async () => {
    const decoy = certificate('Different issuer', 'Same serial decoy');
    const target = certificate();
    const result = await parseNugetSignature(container([decoy, target], [signer(target)]));
    expect(result.map(value => value.serialNumber)).toEqual(['01', '01']);
    expect(result.map(value => value.signer)).toEqual([false, true]);
  });

  it('preserves issuer RDN grouping so identical flattened attributes cannot mark a different issuer', async () => {
    const cn: [string, string] = ['2.5.4.3', 'Issuer'];
    const organization: [string, string] = ['2.5.4.10', 'Organization'];
    const target = certificate();
    const decoy = certificate();
    target.issuer = groupedName([[cn], [organization]]);
    decoy.issuer = groupedName([[cn, organization]]);
    const result = await parseNugetSignature(container([decoy, target], [signer(target)]));
    expect(result.map(value => value.signer)).toEqual([false, true]);
  });

  it('matches equivalent issuer DirectoryString encodings and unordered attributes within each RDN', async () => {
    const source = certificate();
    const differentlyEncoded = new IssuerAndSerialNumber({ issuer: name('Fixture issuer', true), serialNumber: source.serialNumber });
    expect((await parseNugetSignature(container([source], [signer(source, differentlyEncoded)])))[0].signer).toBe(true);
    const cn: [string, string] = ['2.5.4.3', 'Issuer'];
    const organization: [string, string] = ['2.5.4.10', 'Organization'];
    source.issuer = groupedName([[cn, organization]]);
    const reversedSet = new IssuerAndSerialNumber({ issuer: groupedName([[organization, cn]]), serialNumber: source.serialNumber });
    expect((await parseNugetSignature(container([source], [signer(source, reversedSet)])))[0].signer).toBe(true);
  });

  it.each([{ bmp: false, version: 0 }, { bmp: true, version: 2 }])('decodes UTF8/BMP distinguished names in X.509 v$version containers', async options => {
    const source = certificate('测试颁发者', '测试客户 λ', options);
    source.notAfter = new Time({ type: 1, value: new Date('2055-02-03T04:05:06Z') });
    const [result] = await parseNugetSignature(container([source]));
    expect(result.subject).toBe('CN=测试客户 λ');
    expect(result.issuer).toBe('CN=测试颁发者');
    expect(result.notAfter.toISOString()).toBe('2055-02-03T04:05:06.000Z');
  });

  it('escapes ambiguous DN separators and backslashes while keeping decoded text', async () => {
    const source = certificate('issuer', ' Alice, A\\B+Team ');
    const [result] = await parseNugetSignature(container([source]));
    expect(result.subject).toBe('CN=\\ Alice\\, A\\\\B\\+Team\\ ');
  });

  it('renders an unknown binary DN value as ASN.1 hex instead of assuming a string', async () => {
    const source = certificate();
    source.subject = new RelativeDistinguishedNames({ schema: new asn1js.Sequence({ value: [new asn1js.Set({ value: [new asn1js.Sequence({ value: [new asn1js.ObjectIdentifier({ value: '1.2.3.4.5' }), new asn1js.OctetString({ valueHex: Uint8Array.of(0, 255) })] })] })] }) });
    const [result] = await parseNugetSignature(container([source]));
    expect(result.subject).toBe('1.2.3.4.5=#040200ff');
  });

  it.each([false, true])('matches an actual SubjectKeyIdentifier extension for constructed=%s SID', async constructed => {
    const id = Uint8Array.of(1, 2, 3, 4, 5);
    const target = certificate('issuer', 'SKI target', { ski: id });
    const decoy = certificate('issuer', 'Different SKI', { ski: Uint8Array.of(9, 8, 7) });
    const sid = constructed
      ? new asn1js.Constructed({ idBlock: { tagClass: 3, tagNumber: 0 }, value: [new asn1js.OctetString({ valueHex: id })] })
      : new asn1js.Primitive({ idBlock: { tagClass: 3, tagNumber: 0 }, valueHex: id });
    const result = await parseNugetSignature(container([decoy, target], [signer(target, sid)]));
    expect(result.map(value => value.signer)).toEqual([false, true]);
  });

  it('does not invent a signer when a SKI identifier has no matching certificate extension', async () => {
    const source = certificate('issuer', 'No SKI', { version: 0 });
    const sid = new asn1js.Primitive({ idBlock: { tagClass: 3, tagNumber: 0 }, valueHex: Uint8Array.of(1, 2, 3) });
    const [result] = await parseNugetSignature(container([source], [signer(source, sid)]));
    expect(result.signer).toBe(false);
  });

  it('hashes and exports original certificate encoding instead of normalizing BER bytes', async () => {
    const source = certificate();
    const canonical = encoded(source.toSchema(true));
    expect(canonical[1] & 0x80).toBe(0x80);
    const count = canonical[1] & 0x7f;
    // A legal BER long length with an extra leading zero normalizes when re-encoded.
    const original = Uint8Array.from([canonical[0], 0x80 | (count + 1), 0, ...canonical.subarray(2)]);
    const normalized = encoded(asn1js.fromBER(original).result);
    expect(normalized).not.toEqual(original);
    const [result] = await parseNugetSignature(rawCertificateContainer(original, source));
    expect(pemBytes(result.pem)).toEqual(original);
    expect(result.sha1).toBe(hash('sha1', original));
    expect(result.sha256).toBe(hash('sha256', original));
    expect(result.sha256).not.toBe(hash('sha256', normalized));
  });

  it('returns an empty metadata list for a valid SignedData certificate bag without certificates', async () => {
    await expect(parseNugetSignature(container([], []))).resolves.toEqual([]);
  });
});

describe('untrusted CMS input boundaries', () => {
  it.each([Uint8Array.of(0x30, 0x82, 1), Uint8Array.of(0x30, 0x80), fixtureSignature.subarray(0, fixtureSignature.length - 1)])('rejects malformed or truncated ASN.1', async bytes => {
    await expect(parseNugetSignature(bytes)).rejects.toThrow();
  });

  it('rejects trailing data and non-SignedData CMS', async () => {
    await expect(parseNugetSignature(Uint8Array.from([...fixtureSignature, 0]))).rejects.toThrow('Trailing bytes');
    const other = encoded(new ContentInfo({ contentType: ContentInfo.DATA, content: new asn1js.OctetString() }).toSchema());
    await expect(parseNugetSignature(other)).rejects.toThrow('not SignedData');
    const invalid = encoded(new ContentInfo({ contentType: ContentInfo.SIGNED_DATA, content: new asn1js.Sequence() }).toSchema());
    await expect(parseNugetSignature(invalid)).rejects.toThrow();
  });

  it('rejects empty and oversized input before parsing', async () => {
    for (const bytes of [new Uint8Array(), new Uint8Array(16 * 1024 * 1024 + 1)]) {
      await expect(parseNugetSignature(bytes)).rejects.toThrow('between 1 byte and 16 MiB');
    }
  });

  it('bounds nesting, node count and certificate count', async () => {
    let deep: asn1js.AsnType = new asn1js.Null();
    for (let level = 0; level < 70; level++) deep = new asn1js.Sequence({ value: [deep] });
    await expect(parseNugetSignature(encoded(deep))).rejects.toThrow('Maximum ASN.1 nesting depth');
    const manyNodes = new asn1js.Sequence({ value: Array.from({ length: 10001 }, () => new asn1js.Null()) });
    await expect(parseNugetSignature(encoded(manyNodes))).rejects.toThrow('Maximum ASN.1 node count');
    const source = certificate();
    await expect(parseNugetSignature(container(Array.from({ length: 65 }, () => source)))).rejects.toThrow('more than 64 certificates');
  });
});
