export interface NuspecMetadata {
  description: string;
  authors: string;
  projectUrl: string;
  license: string;
}

export const parseNuspecMetadata = (xmlString: string): NuspecMetadata => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const metadata = doc.getElementsByTagName('metadata')[0];
  if (!metadata) {
    return { description: 'N/A', authors: 'N/A', projectUrl: 'N/A', license: 'N/A' };
  }

  const getText = (name: string) => metadata.getElementsByTagName(name)[0]?.textContent?.trim() || '';
  return {
    description: getText('description') || 'N/A',
    authors: getText('authors') || 'N/A',
    projectUrl: getText('projectUrl') || 'N/A',
    license: getText('license') || getText('licenseUrl') || 'N/A',
  };
};

export const normalizeFingerprint = (hex: string, withColons = true) => {
  const clean = hex.replace(/^0x/i, '').replace(/[\s:]/g, '').toUpperCase();
  return withColons ? clean.match(/.{1,2}/g)?.join(':') || clean : clean;
};

export const getCertificateDateStatus = (notBefore: Date, notAfter: Date, now = new Date()) => {
  if (now < notBefore) return 'not-yet-active' as const;
  if (now > notAfter) return 'expired' as const;
  return 'valid' as const;
};

