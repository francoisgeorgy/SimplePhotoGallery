import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

jest.mock('node:child_process', () => ({
  spawnSync: jest.fn(),
}));

import { GalleryDataSchema } from '@simple-photo-gallery/common';

import { CLOUDFLARE_ANALYTICS_SCRIPT } from '../src/config';
import { build } from '../src/modules/build';
import { init } from '../src/modules/init';

import type { ConsolaInstance } from 'consola';

const spawnSyncMock = spawnSync as jest.MockedFunction<typeof spawnSync>;

const createMockUI = (): ConsolaInstance =>
  ({
    box: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    prompt: jest.fn(),
    start: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
  }) as unknown as ConsolaInstance;

describe('Analytics Script', () => {
  let tempDir: string;
  let photosDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spg-analytics-test-'));
    photosDir = path.join(tempDir, 'photos');
    fs.mkdirSync(photosDir, { recursive: true });
    fs.writeFileSync(path.join(photosDir, 'photo1.jpg'), 'fake-image-content');

    spawnSyncMock.mockReset();
    spawnSyncMock.mockImplementation((_command, _args, options) => {
      const outputDir = (options as { env?: Record<string, string | undefined> }).env?.GALLERY_OUTPUT_DIR;
      if (!outputDir) {
        throw new Error('Missing GALLERY_OUTPUT_DIR');
      }

      const buildDir = path.join(outputDir, '_build');
      fs.mkdirSync(buildDir, { recursive: true });
      fs.writeFileSync(path.join(buildDir, 'index.html'), '<html><body>built</body></html>');

      return { status: 0, signal: null, stdout: '', stderr: '' } as ReturnType<typeof spawnSync>;
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('CLOUDFLARE_ANALYTICS_SCRIPT matches expected Cloudflare Web Analytics beacon script', () => {
    expect(CLOUDFLARE_ANALYTICS_SCRIPT).toBe(
      "<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{\"token\": \"1206394fc0414cff98bf51764690aeda\"}'></script><!-- End Cloudflare Web Analytics -->",
    );
  });

  test('should allow optional analyticsScript field in gallery.json', () => {
    const galleryData = {
      title: 'Test Gallery',
      description: 'Test description',
      headerImage: 'test.jpg',
      metadata: {},
      sections: [
        {
          images: [],
        },
      ],
      subGalleries: {
        title: 'Sub Galleries',
        galleries: [],
      },
      analyticsScript: '<script>console.log("analytics")</script>',
    };

    // Should not throw with analyticsScript
    expect(() => GalleryDataSchema.parse(galleryData)).not.toThrow();
    const validatedData = GalleryDataSchema.parse(galleryData);
    expect(validatedData.analyticsScript).toBe('<script>console.log("analytics")</script>');
  });

  test('should allow gallery.json without analyticsScript field', () => {
    const galleryData = {
      title: 'Test Gallery',
      description: 'Test description',
      headerImage: 'test.jpg',
      metadata: {},
      sections: [
        {
          images: [],
        },
      ],
      subGalleries: {
        title: 'Sub Galleries',
        galleries: [],
      },
    };

    // Should not throw without analyticsScript
    expect(() => GalleryDataSchema.parse(galleryData)).not.toThrow();
    const validatedData = GalleryDataSchema.parse(galleryData);
    expect(validatedData.analyticsScript).toBeUndefined();
  });

  test('init without --cloudflare does not add analyticsScript by default', async () => {
    const ui = createMockUI();
    await init(
      {
        photos: photosDir,
        recursive: false,
        default: true,
        force: true,
      },
      ui,
    );

    const galleryJsonPath = path.join(photosDir, 'gallery', 'gallery.json');
    const galleryData = JSON.parse(fs.readFileSync(galleryJsonPath, 'utf8'));
    expect(galleryData.analyticsScript).toBeUndefined();
  });

  test('init with --cloudflare adds Cloudflare Web Analytics script to gallery.json', async () => {
    const ui = createMockUI();
    await init(
      {
        photos: photosDir,
        recursive: false,
        default: true,
        force: true,
        cloudflare: true,
      },
      ui,
    );

    const galleryJsonPath = path.join(photosDir, 'gallery', 'gallery.json');
    const galleryData = JSON.parse(fs.readFileSync(galleryJsonPath, 'utf8'));
    expect(galleryData.analyticsScript).toBe(CLOUDFLARE_ANALYTICS_SCRIPT);
  });

  test('init with --config and cloudflare: true adds analyticsScript', async () => {
    const configPath = path.join(tempDir, 'config.txt');
    fs.writeFileSync(
      configPath,
      `
base folder : ${photosDir}
title : My Photos
cloudflare : true
`,
      'utf8',
    );

    const ui = createMockUI();
    await init(
      {
        photos: photosDir,
        config: configPath,
        recursive: false,
        default: false,
        force: true,
      },
      ui,
    );

    const galleryJsonPath = path.join(photosDir, 'gallery', 'gallery.json');
    const galleryData = JSON.parse(fs.readFileSync(galleryJsonPath, 'utf8'));
    expect(galleryData.analyticsScript).toBe(CLOUDFLARE_ANALYTICS_SCRIPT);
  });

  test('build with --cloudflare updates gallery.json with Cloudflare Web Analytics script', async () => {
    // 1. Initialize gallery without cloudflare
    const ui = createMockUI();
    await init(
      {
        photos: photosDir,
        recursive: false,
        default: true,
        force: true,
      },
      ui,
    );

    const galleryJsonPath = path.join(photosDir, 'gallery', 'gallery.json');
    let galleryData = JSON.parse(fs.readFileSync(galleryJsonPath, 'utf8'));
    expect(galleryData.analyticsScript).toBeUndefined();

    // 2. Build with --cloudflare (mocking theme resolution isn't needed if we use default or test with mock)
    // Create a mock theme
    const themeDir = path.join(tempDir, 'theme');
    const astroDir = path.join(themeDir, 'node_modules', 'astro');
    fs.mkdirSync(themeDir, { recursive: true });
    fs.mkdirSync(astroDir, { recursive: true });
    fs.writeFileSync(
      path.join(themeDir, 'package.json'),
      JSON.stringify({ name: 'test-theme', version: '1.0.0', type: 'module' }, null, 2),
    );
    fs.writeFileSync(
      path.join(astroDir, 'package.json'),
      JSON.stringify({ name: 'astro', bin: { astro: 'astro.js' } }, null, 2),
    );
    fs.writeFileSync(path.join(astroDir, 'astro.js'), '');

    await build(
      {
        gallery: photosDir,
        recursive: false,
        scan: false,
        prune: false,
        thumbnails: false,
        yes: true,
        theme: themeDir,
        cloudflare: true,
      },
      ui,
    );

    galleryData = JSON.parse(fs.readFileSync(galleryJsonPath, 'utf8'));
    expect(galleryData.analyticsScript).toBe(CLOUDFLARE_ANALYTICS_SCRIPT);
  });
});
