import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { init } from '../src/modules/init';
import { loadInitConfig, normalizeAlbumPath, parseInitConfig } from '../src/modules/init/utils';

import type { ConsolaInstance } from 'consola';

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

describe('normalizeAlbumPath', () => {
  test('normalizes album folder paths with different slashes and relative prefixes', () => {
    expect(normalizeAlbumPath('after-hours')).toBe('after-hours');
    expect(normalizeAlbumPath('./after-hours')).toBe('after-hours');
    expect(normalizeAlbumPath('after-hours/')).toBe('after-hours');
    expect(normalizeAlbumPath('trips/italy')).toBe('trips/italy');
    expect(normalizeAlbumPath(String.raw`trips\italy`)).toBe('trips/italy');
    expect(normalizeAlbumPath('/trips/italy/')).toBe('trips/italy');
  });
});

describe('parseInitConfig & loadInitConfig', () => {
  test('loads and parses a config file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spg-load-init-config-test-'));
    const configPath = path.join(tempDir, 'gallery-config.txt');
    fs.writeFileSync(
      configPath,
      [
        'base folder : /photos',
        'title : Portfolio',
        'description : Curated photographs',
        'url : https://photos.example.com/',
        'cloudflare : true',
        '',
        'albums:',
        'after-hours : After Hours : Night photographs',
      ].join('\n'),
      'utf8',
    );

    try {
      await expect(loadInitConfig(configPath)).resolves.toEqual({
        albums: {
          'after-hours': {
            folder: 'after-hours',
            title: 'After Hours',
            description: 'Night photographs',
          },
        },
        baseFolder: '/photos',
        title: 'Portfolio',
        description: 'Curated photographs',
        url: 'https://photos.example.com/',
        cloudflare: true,
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('loads localized root and album metadata from a JSON config file', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spg-load-localized-init-config-test-'));
    const configPath = path.join(tempDir, 'gallery-config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        baseFolder: '/photos',
        defaultLanguage: 'en',
        title: {
          en: 'Photographs',
          fr: 'Photographies',
        },
        description: {
          en: '',
          fr: '',
        },
        albums: {
          'after-hours': {
            title: {
              en: 'After Hours',
              fr: 'Après la tombée de la nuit',
            },
            description: {
              en: 'Night photographs',
              fr: 'Photographies de nuit',
            },
          },
        },
      }),
      'utf8',
    );

    try {
      await expect(loadInitConfig(configPath)).resolves.toEqual({
        baseFolder: '/photos',
        defaultLanguage: 'en',
        title: {
          en: 'Photographs',
          fr: 'Photographies',
        },
        description: {
          en: '',
          fr: '',
        },
        albums: {
          'after-hours': {
            folder: 'after-hours',
            title: {
              en: 'After Hours',
              fr: 'Après la tombée de la nuit',
            },
            description: {
              en: 'Night photographs',
              fr: 'Photographies de nuit',
            },
          },
        },
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('supports key aliases, comments, empty lines, and descriptions with colons', () => {
    const rawContent = `
# This is a comment
basefolder : /path/to/photos
base url : https://example.com/gallery/
description : Root description
cloudflare : true
unknown_key : ignored

albums:
# album comment
album-one : Album One : Description with : colons : inside
album-two : Album Two : Normal description
`;

    const config = parseInitConfig(rawContent, 'test-config.txt');

    expect(config.baseFolder).toBe('/path/to/photos');
    expect(config.url).toBe('https://example.com/gallery/');
    expect(config.description).toBe('Root description');
    expect(config.cloudflare).toBe(true);
    expect(config.albums['album-one']).toEqual({
      folder: 'album-one',
      title: 'Album One',
      description: 'Description with : colons : inside',
    });
    expect(config.albums['album-two']).toEqual({
      folder: 'album-two',
      title: 'Album Two',
      description: 'Normal description',
    });
  });

  test('throws error for invalid album lines', () => {
    const rawContent = `
title: Test
albums:
invalid-line-without-separator
`;

    expect(() => parseInitConfig(rawContent, 'config.txt')).toThrow(
      'Invalid album line in config.txt: "invalid-line-without-separator". Expected "folder : title : description".',
    );
  });
});

describe('init with --config', () => {
  let tempDir: string;
  let photosDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spg-init-config-test-'));
    photosDir = path.join(tempDir, 'photos');
    fs.mkdirSync(photosDir, { recursive: true });

    // Create subfolders with images
    const afterHoursDir = path.join(photosDir, 'after-hours');
    const monochromeDir = path.join(photosDir, 'monochrome');
    const otherDir = path.join(photosDir, 'other-album');

    fs.mkdirSync(afterHoursDir, { recursive: true });
    fs.mkdirSync(monochromeDir, { recursive: true });
    fs.mkdirSync(otherDir, { recursive: true });

    fs.writeFileSync(path.join(afterHoursDir, 'night1.jpg'), 'fake-image');
    fs.writeFileSync(path.join(afterHoursDir, 'night2.jpg'), 'fake-image');
    fs.writeFileSync(path.join(monochromeDir, 'bw1.jpg'), 'fake-image');
    fs.writeFileSync(path.join(otherDir, 'photo.jpg'), 'fake-image');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('initializes recursive gallery using config file without prompts', async () => {
    const configFilePath = path.join(tempDir, 'gallery-config.txt');
    const configContent = `
base folder : ${photosDir}
title : Photographs
description : A curated collection of photographs by François Georgy
url : https://photos.francoisgeorgy.ch/

albums (folder name : album name : album description):
after-hours : After Hours : Ville, crépuscule, nuit, lumières artificielles
monochrome : Monochrome : Sélection de photographies noir et blanc
`;

    fs.writeFileSync(configFilePath, configContent, 'utf8');

    const ui = createMockUI();

    const result = await init(
      {
        photos: tempDir, // Should be overridden by base folder in config
        config: configFilePath,
        recursive: false, // Should be forced to true by config
        default: false,
        force: false,
      },
      ui,
    );

    // Assert prompts were never called
    expect(ui.prompt).not.toHaveBeenCalled();

    // Assert result counts: 4 files across 3 subgalleries + 1 root gallery = 4 galleries
    expect(result).toEqual({ processedMediaCount: 4, processedGalleryCount: 4 });

    // 1. Verify root gallery
    const rootGalleryPath = path.join(photosDir, 'gallery', 'gallery.json');
    expect(fs.existsSync(rootGalleryPath)).toBe(true);
    const rootData = JSON.parse(fs.readFileSync(rootGalleryPath, 'utf8'));

    expect(rootData.title).toBe('Photographs');
    expect(rootData.description).toBe('A curated collection of photographs by François Georgy');
    expect(rootData.url).toBe('https://photos.francoisgeorgy.ch/');
    expect(rootData.subGalleries.title).toBe('Photographs');
    expect(rootData.subGalleries.description).toBe('A curated collection of photographs by François Georgy');

    // Sub-galleries list in root should have configured titles
    const subGalleryTitles = rootData.subGalleries.galleries.map((g: { title: string }) => g.title);
    expect(subGalleryTitles).toContain('After Hours');
    expect(subGalleryTitles).toContain('Monochrome');
    expect(subGalleryTitles).toContain('Other Album');

    // 2. Verify after-hours gallery
    const afterHoursGalleryPath = path.join(photosDir, 'after-hours', 'gallery', 'gallery.json');
    expect(fs.existsSync(afterHoursGalleryPath)).toBe(true);
    const afterHoursData = JSON.parse(fs.readFileSync(afterHoursGalleryPath, 'utf8'));

    expect(afterHoursData.title).toBe('After Hours');
    expect(afterHoursData.description).toBe('Ville, crépuscule, nuit, lumières artificielles');
    expect(afterHoursData.url).toBe('https://photos.francoisgeorgy.ch/after-hours/');
    expect(afterHoursData.navigation.home).toEqual({
      label: 'Photographs',
      path: '../',
    });

    // 3. Verify monochrome gallery
    const monochromeGalleryPath = path.join(photosDir, 'monochrome', 'gallery', 'gallery.json');
    expect(fs.existsSync(monochromeGalleryPath)).toBe(true);
    const monochromeData = JSON.parse(fs.readFileSync(monochromeGalleryPath, 'utf8'));

    expect(monochromeData.title).toBe('Monochrome');
    expect(monochromeData.description).toBe('Sélection de photographies noir et blanc');
    expect(monochromeData.url).toBe('https://photos.francoisgeorgy.ch/monochrome/');
    expect(monochromeData.navigation.home).toEqual({
      label: 'Photographs',
      path: '../',
    });

    // 4. Verify unconfigured album uses capitalized title
    const otherGalleryPath = path.join(photosDir, 'other-album', 'gallery', 'gallery.json');
    expect(fs.existsSync(otherGalleryPath)).toBe(true);
    const otherData = JSON.parse(fs.readFileSync(otherGalleryPath, 'utf8'));

    expect(otherData.title).toBe('Other Album');
    expect(otherData.description).toBe('My gallery with fantastic photos.');
  });

  test('writes localized root and album metadata from a JSON config file', async () => {
    const configFilePath = path.join(tempDir, 'gallery-config.json');
    fs.writeFileSync(
      configFilePath,
      JSON.stringify({
        baseFolder: photosDir,
        defaultLanguage: 'en',
        title: {
          en: 'Photographs',
          fr: 'Photographies',
        },
        description: {
          en: '',
          fr: '',
        },
        albums: {
          'after-hours': {
            title: {
              en: 'After Hours',
              fr: 'Après la tombée de la nuit',
            },
            description: {
              en: 'Night photographs',
              fr: 'Photographies de nuit',
            },
          },
        },
      }),
      'utf8',
    );

    await init(
      {
        photos: tempDir,
        config: configFilePath,
        recursive: false,
        default: false,
        force: false,
      },
      createMockUI(),
    );

    const afterHoursData = JSON.parse(
      fs.readFileSync(path.join(photosDir, 'after-hours', 'gallery', 'gallery.json'), 'utf8'),
    );
    expect(afterHoursData).toMatchObject({
      title: 'After Hours',
      description: 'Night photographs',
      defaultLanguage: 'en',
      translations: {
        en: {
          title: 'After Hours',
          description: 'Night photographs',
        },
        fr: {
          title: 'Après la tombée de la nuit',
          description: 'Photographies de nuit',
        },
      },
    });

    const rootData = JSON.parse(fs.readFileSync(path.join(photosDir, 'gallery', 'gallery.json'), 'utf8'));
    const afterHoursCard = rootData.subGalleries.galleries.find(
      (gallery: { path: string }) => gallery.path === '../after-hours',
    );
    expect(rootData.defaultLanguage).toBe('en');
    expect(rootData).toMatchObject({
      title: 'Photographs',
      description: '',
      translations: {
        en: {
          title: 'Photographs',
          description: '',
        },
        fr: {
          title: 'Photographies',
          description: '',
        },
      },
      subGalleries: {
        title: 'Photographs',
      },
    });
    expect(rootData.subGalleries).not.toHaveProperty('description');
    expect(afterHoursCard).toMatchObject({
      title: 'After Hours',
      translations: afterHoursData.translations,
    });
  });

  test('fails without --force when gallery already exists and overwrites when --force is provided', async () => {
    const configFilePath = path.join(tempDir, 'gallery-config.txt');
    const configContent = `
base folder : ${photosDir}
title : Photographs
url : https://photos.francoisgeorgy.ch/

albums:
after-hours : After Hours : Night photos
`;
    fs.writeFileSync(configFilePath, configContent, 'utf8');

    const ui = createMockUI();

    // First run creates the galleries
    await init(
      {
        photos: photosDir,
        config: configFilePath,
        recursive: false,
        default: false,
        force: false,
      },
      ui,
    );

    // Second run without force should throw an error in non-TTY mode
    await expect(
      init(
        {
          photos: photosDir,
          config: configFilePath,
          recursive: false,
          default: false,
          force: false,
        },
        ui,
      ),
    ).rejects.toThrow(/Gallery already exists at .* Use --force to overwrite it\./);

    // Third run with force should succeed
    const forceResult = await init(
      {
        photos: photosDir,
        config: configFilePath,
        recursive: false,
        default: false,
        force: true,
      },
      ui,
    );

    expect(forceResult.processedGalleryCount).toBe(4);
  });
});
