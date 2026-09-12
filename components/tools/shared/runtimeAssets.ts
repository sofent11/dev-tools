import assets from '../../../src/runtime-assets.json';
export const runtimeAsset = (name: keyof typeof assets) => ({ ...assets[name], url: `${import.meta.env.BASE_URL}${assets[name].path}` });
