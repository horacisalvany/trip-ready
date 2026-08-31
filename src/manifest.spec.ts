interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

interface WebManifest {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  icons: ManifestIcon[];
}

/**
 * The home-screen icon (Add to Home Screen) comes from the web app manifest on
 * Android/Chrome and from apple-touch-icon on iOS. Without them the browser
 * renders a generated letter tile instead, which is the bug this guards.
 */
describe('web app manifest', () => {
  let manifest: WebManifest;

  beforeAll(async () => {
    const response = await fetch('/manifest.webmanifest');
    expect(response.ok).toBe(true);
    manifest = await response.json();
  });

  it('declares a standalone app named TripReady', () => {
    expect(manifest.name).toBe('TripReady');
    expect(manifest.short_name).toBe('TripReady');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#9c27b0');
  });

  it('declares the 192 and 512 icon sizes install prompts require', () => {
    const anySizes = manifest.icons
      .filter((icon) => icon.purpose === 'any')
      .map((icon) => icon.sizes);

    expect(anySizes).toContain('192x192');
    expect(anySizes).toContain('512x512');
  });

  it('declares maskable icons so Android does not fall back to a letter tile', () => {
    const maskable = manifest.icons.filter(
      (icon) => icon.purpose === 'maskable'
    );

    expect(maskable.length).toBeGreaterThan(0);
    maskable.forEach((icon) => expect(icon.type).toBe('image/png'));
  });

  it('points every icon at a file that is actually served', async () => {
    for (const icon of manifest.icons) {
      const response = await fetch(`/${icon.src}`);

      expect(response.ok)
        .withContext(`missing icon: ${icon.src}`)
        .toBe(true);
    }
  });

  it('serves the iOS apple-touch-icon', async () => {
    const response = await fetch('/assets/img/apple-touch-icon.png');

    expect(response.ok).toBe(true);
  });
});
