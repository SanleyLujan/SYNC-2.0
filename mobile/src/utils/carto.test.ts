import { getCartoTileUrl } from './carto';

describe('CARTO tile configuration', () => {
  const original = process.env.EXPO_PUBLIC_CARTO_API_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.EXPO_PUBLIC_CARTO_API_KEY;
    else process.env.EXPO_PUBLIC_CARTO_API_KEY = original;
  });

  it('preserves tile placeholders and the dark style with the configured key', () => {
    process.env.EXPO_PUBLIC_CARTO_API_KEY = ' test-key ';
    expect(getCartoTileUrl()).toBe('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=test-key');
  });

  it('supports Voyager and safely encodes keys in the legacy script', () => {
    process.env.EXPO_PUBLIC_CARTO_API_KEY = "a'&</script>";
    expect(getCartoTileUrl(false)).toBe('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=a%27%26%3C%2Fscript%3E');
  });

  it('does not send an undefined credential', () => {
    delete process.env.EXPO_PUBLIC_CARTO_API_KEY;
    expect(getCartoTileUrl()).not.toContain('?key=');
  });
});
