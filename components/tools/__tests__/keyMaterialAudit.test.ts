// @vitest-environment node
import { generateKeyPairSync, webcrypto } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { certificateMatchesPrivateKey, certificatePublicKey, decodePem, importKeyMaterial, readKeyMaterial } from '../security/keyMaterial';
beforeAll(() => vi.stubGlobal('crypto', webcrypto));
afterAll(() => vi.unstubAllGlobals());
const concat = (...values: Uint8Array[]) => Uint8Array.from(values.flatMap(value => Array.from(value)));
const tlv = (tag: number, value: Uint8Array) => {
  const bytes: number[] = []; let length = value.length;
  if (length < 128) bytes.push(length); else { while (length) { bytes.unshift(length & 255); length = Math.floor(length / 256); } bytes.unshift(128 | bytes.length); }
  return Uint8Array.from([tag,...bytes,...value]);
};
const certificate = (spki: Uint8Array) => tlv(0x30, concat(tlv(0x30, concat(Uint8Array.of(2,1,1), tlv(0x30,new Uint8Array()),tlv(0x30,new Uint8Array()),tlv(0x30,new Uint8Array()),tlv(0x30,new Uint8Array()),spki)),tlv(0x30,new Uint8Array()),Uint8Array.of(3,1,0)));
const der = async (key: CryptoKey, format: 'pkcs8'|'spki') => new Uint8Array(await crypto.subtle.exportKey(format,key));
const rsa = () => crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:Uint8Array.of(1,0,1),hash:'SHA-256'},true,['sign','verify']);
describe('real local key containers', () => {
  it('reads actual RSA modulus length and verifies certificate/private key parameters', async () => {
    const [pair, other] = await Promise.all([rsa(),rsa()]);
    const privateDer = await der(pair.privateKey,'pkcs8'); const publicDer = await der(pair.publicKey,'spki');
    expect(readKeyMaterial(privateDer)).toMatchObject({kind:'RSA',bits:2048,privateKey:true});
    expect(readKeyMaterial(publicDer)).toMatchObject({kind:'RSA',bits:2048,privateKey:false});
    await expect(importKeyMaterial(readKeyMaterial(privateDer))).resolves.toBeDefined();
    const cert = certificate(publicDer);
    expect(certificatePublicKey(cert)).toEqual(publicDer);
    await expect(certificateMatchesPrivateKey(cert,privateDer)).resolves.toBe(true);
    await expect(certificateMatchesPrivateKey(cert,await der(other.privateKey,'pkcs8'))).resolves.toBe(false);
    await expect(certificateMatchesPrivateKey(cert,publicDer)).resolves.toBe(false);
  });
  it.each(['P-256','P-384','P-521'])('reads and imports %s via actual algorithm OIDs', async curve => {
    const pair = await crypto.subtle.generateKey({name:'ECDSA',namedCurve:curve},true,['sign','verify']);
    const privateDer = await der(pair.privateKey,'pkcs8'); const publicDer = await der(pair.publicKey,'spki');
    expect(readKeyMaterial(privateDer)).toMatchObject({kind:'EC',curve,bits:Number(curve.slice(2)),privateKey:true});
    await expect(importKeyMaterial(readKeyMaterial(publicDer))).resolves.toBeDefined();
    await expect(certificateMatchesPrivateKey(certificate(publicDer),privateDer)).resolves.toBe(true);
  });
  it('normalizes real PKCS#1 private/public and SEC1 private keys for Web Crypto imports', async () => {
    const rsaPair = generateKeyPairSync('rsa', {modulusLength:2048, publicKeyEncoding:{type:'pkcs1',format:'der'},privateKeyEncoding:{type:'pkcs1',format:'der'}});
    for (const [bytes, privateKey] of [[rsaPair.privateKey,true],[rsaPair.publicKey,false]] as const) {
      const material = readKeyMaterial(bytes);
      expect(material).toMatchObject({kind:'RSA',bits:2048,privateKey});
      await expect(importKeyMaterial(material)).resolves.toBeDefined();
    }
    const ecPair = generateKeyPairSync('ec', {namedCurve:'prime256v1', publicKeyEncoding:{type:'spki',format:'der'},privateKeyEncoding:{type:'sec1',format:'der'}});
    const material = readKeyMaterial(ecPair.privateKey);
    expect(material).toMatchObject({kind:'EC',curve:'P-256',privateKey:true});
    await expect(importKeyMaterial(material)).resolves.toBeDefined();
  });
  it('rejects fake/truncated DER, mismatched PEM labels, and unsupported data instead of assigning a safety rating', () => {
    for (const bytes of [new Uint8Array(500),Uint8Array.of(0x30,0x80),Uint8Array.of(0x30,3,2,1),Uint8Array.of(0x30,0,0)]) expect(() => readKeyMaterial(bytes)).toThrow();
    expect(() => decodePem('-----BEGIN PUBLIC KEY-----\nMAA=\n-----END PRIVATE KEY-----')).toThrow();
    expect(decodePem('-----BEGIN PUBLIC KEY-----\nMAA=\n-----END PUBLIC KEY-----')).toEqual(Uint8Array.of(48,0));
  });
});
