import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { joinUrl, toUrlPath } from '@simple-photo-gallery/common/theme';

import { capitalizeTitle, getMediaFileType } from './utils';

import { findGalleries, shouldSkipDirectory } from '../../utils';

import type { GallerySettingsFromUser, ProcessDirectoryResult, ScanDirectoryResult, ScanOptions, SubGallery } from './types';
import type { CommandResultSummary } from '../telemetry/types';
import type { GalleryData, MediaFile } from '@simple-photo-gallery/common';
import type { ConsolaInstance } from 'consola';

/**
 * Scans a directory for media files and subdirectories
 * @param dirPath - Path to the directory to scan
 * @param ui - ConsolaInstance for logging
 * @returns Promise resolving to scan results with media files and subdirectories
 */
export async function scanDirectory(dirPath: string, ui: ConsolaInstance): Promise<ScanDirectoryResult> {
  const mediaFiles: MediaFile[] = [];
  const subGalleryDirectories: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const mediaType = getMediaFileType(entry.name);

        if (mediaType) {
          const mediaFile: MediaFile = {
            type: mediaType,
            filename: entry.name,
            width: 0,
            height: 0,
          };

          mediaFiles.push(mediaFile);
        }
      } else if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
        subGalleryDirectories.push(path.join(dirPath, entry.name));
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      ui.error(`Directory does not exist: ${dirPath}`);
    } else if (error instanceof Error && error.message.includes('ENOTDIR')) {
      ui.error(`Path is not a directory: ${dirPath}`);
    } else {
      ui.error(`Error scanning directory ${dirPath}:`, error);
    }

    throw error;
  }

  // Sort the results for a deterministic gallery order; fs.readdir order depends on the file system
  mediaFiles.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }));
  subGalleryDirectories.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return { mediaFiles, subGalleryDirectories };
}

/**
 * Prompts the user for gallery settings through interactive CLI
 * @param galleryContext - Human-readable directory context shown in prompts
 * @param defaultImage - Default header image path
 * @param ui - ConsolaInstance for prompting and logging
 * @returns Promise resolving to user-provided gallery settings
 */
async function getGallerySettingsFromUser(
  galleryContext: string,
  defaultImage: string,
  galleryUrl: string,
  ui: ConsolaInstance,
): Promise<GallerySettingsFromUser> {
  ui.info(`Configuring ${galleryContext}`);

  const title = await ui.prompt(`[${galleryContext}] Enter gallery title`, {
    type: 'text',
    default: 'My Gallery',
    placeholder: 'My Gallery',
  });
  const description = await ui.prompt(`[${galleryContext}] Enter gallery description`, {
    type: 'text',
    default: 'My gallery with fantastic photos.',
    placeholder: 'My gallery with fantastic photos.',
  });
  const headerImage = await ui.prompt(`[${galleryContext}] Enter the name of the header image`, {
    type: 'text',
    default: defaultImage,
    placeholder: defaultImage,
  });

  return {
    title,
    description,
    url: galleryUrl,
    headerImage,
    thumbnails: {
      size: '',
      edge: undefined,
    },
  };
}

/**
 * Prompts for the content shown when a gallery contains only sub-galleries.
 */
async function getHomepageSettingsFromUser(
  galleryContext: string,
  galleryUrl: string,
  ui: ConsolaInstance,
): Promise<{ title: string; description: string; url: string }> {
  ui.info(`Configuring homepage for ${galleryContext}`);

  const title = await ui.prompt(`[${galleryContext}] Enter homepage title`, {
    type: 'text',
    default: 'My Gallery',
    placeholder: 'My Gallery',
  });
  const description = await ui.prompt(`[${galleryContext}] Enter homepage description (optional)`, {
    type: 'text',
    default: '',
    placeholder: '',
  });

  return { title, description, url: galleryUrl };
}

/**
 * Builds a gallery URL from the publication base URL and the gallery's relative directory.
 * @param baseUrl - Root URL entered once during initialization
 * @param relativeGalleryPath - Gallery directory relative to the initialized root
 * @returns URL with a trailing slash, or an empty string when no base URL was entered
 */
function getGalleryUrl(baseUrl: string, relativeGalleryPath: string): string {
  if (!baseUrl) {
    return '';
  }

  return `${joinUrl(baseUrl, toUrlPath(relativeGalleryPath))}/`;
}

/** CLI options for theme and thumbnail configuration */
interface InitConfigOptions {
  theme?: string;
  thumbnailSize?: number;
  thumbnailEdge?: 'auto' | 'width' | 'height';
}

/**
 * Creates a gallery.json file with media files and settings
 * @param mediaFiles - Array of media files to include in gallery
 * @param galleryJsonPath - Path where gallery.json should be created
 * @param scanPath - Path to the directory that was scanned
 * @param subGalleries - Array of sub-galleries to include
 * @param galleryUrl - Computed publication URL for this gallery
 * @param galleryContext - Human-readable directory context shown in prompts
 * @param defaultTitle - Title used when prompts are skipped
 * @param useDefaultSettings - Whether to use default settings or prompt user
 * @param ctaBanner - Whether to add a Simple Photo Gallery call-to-action banner
 * @param configOptions - CLI options for theme and thumbnail configuration
 * @param ui - ConsolaInstance for prompting and logging
 * @returns The gallery data written to disk
 */
async function createGalleryJson(
  mediaFiles: MediaFile[],
  galleryJsonPath: string,
  scanPath: string,
  subGalleries: SubGallery[] = [],
  galleryUrl: string,
  galleryContext: string,
  defaultTitle: string,
  useDefaultSettings: boolean,
  ctaBanner: boolean | undefined,
  configOptions: InitConfigOptions,
  ui: ConsolaInstance,
): Promise<GalleryData> {
  const galleryDir = path.dirname(galleryJsonPath);
  const isSubGalleryHomepage = mediaFiles.length === 0 && subGalleries.length > 0;

  // If the gallery is stored in the same location as the media files, use a relative base path, otherwise use an absolute path
  const isSameLocation = path.relative(scanPath, path.join(galleryDir, '..')) === '';
  const mediaBasePath = isSameLocation ? undefined : scanPath;

  // Convert subGallery header image paths to be relative to gallery.json, using forward slashes for portability
  const relativeSubGalleries = subGalleries.map((subGallery) => ({
    ...subGallery,
    headerImage: subGallery.headerImage ? toUrlPath(path.relative(galleryDir, subGallery.headerImage)) : '',
  }));

  // Build thumbnails config from CLI options
  const thumbnailsConfig: { size?: number; edge?: 'auto' | 'width' | 'height' } = {};
  if (configOptions.thumbnailSize !== undefined) {
    thumbnailsConfig.size = configOptions.thumbnailSize;
  }
  if (configOptions.thumbnailEdge !== undefined) {
    thumbnailsConfig.edge = configOptions.thumbnailEdge;
  }

  let galleryData: GalleryData = {
    title: defaultTitle,
    description: 'My gallery with fantastic photos.',
    headerImage: mediaFiles[0]?.filename || '',
    mediaBasePath: mediaBasePath,
    metadata: {},
    // Include theme if provided via CLI
    ...(configOptions.theme && { theme: configOptions.theme }),
    // Include thumbnails if any values were set via CLI
    ...(Object.keys(thumbnailsConfig).length > 0 && { thumbnails: thumbnailsConfig }),
    sections: [
      {
        images: mediaFiles,
      },
    ],
    subGalleries: {
      title: isSubGalleryHomepage ? defaultTitle : 'Sub Galleries',
      galleries: relativeSubGalleries,
    },
    ...(ctaBanner !== undefined && { ctaBanner }),
  };

  if (!useDefaultSettings) {
    if (isSubGalleryHomepage) {
      const homepageSettings = await getHomepageSettingsFromUser(galleryContext, galleryUrl, ui);

      galleryData = {
        ...galleryData,
        ...homepageSettings,
        subGalleries: {
          ...galleryData.subGalleries,
          title: homepageSettings.title,
          ...(homepageSettings.description && { description: homepageSettings.description }),
        },
      };
    } else {
      const userSettings = await getGallerySettingsFromUser(
        galleryContext,
        path.basename(mediaFiles[0]?.filename || ''),
        galleryUrl,
        ui,
      );

      // Extract thumbnail settings (no longer prompted, but structure preserved for compatibility)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { thumbnails, ...otherSettings } = userSettings;

      galleryData = {
        ...galleryData,
        ...otherSettings,
      };
    }
  }

  await fs.writeFile(galleryJsonPath, JSON.stringify(galleryData, null, 2));
  return galleryData;
}

/**
 * Checks if a gallery already exists in the specified directory
 * @param outputPath - Path where gallery would be created
 * @returns Promise resolving to true if gallery exists, false otherwise
 */
async function galleryExists(outputPath: string): Promise<boolean> {
  const galleryPath = path.join(outputPath, 'gallery');
  const galleryJsonPath = path.join(galleryPath, 'gallery.json');

  try {
    await fs.access(galleryJsonPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Adds a relative link back to the root gallery to every generated child gallery.
 * @param outputPath - Root directory containing the generated gallery tree
 */
async function addHomeNavigation(outputPath: string): Promise<void> {
  if (!(await galleryExists(outputPath))) {
    return;
  }

  const rootGalleryJsonPath = path.join(outputPath, 'gallery', 'gallery.json');
  const rootGalleryData = JSON.parse(await fs.readFile(rootGalleryJsonPath, 'utf8')) as GalleryData;
  const homeLabel = rootGalleryData.title || 'Home';

  for (const galleryDir of findGalleries(outputPath, true)) {
    const relativeHomePath = path.relative(galleryDir, outputPath);
    if (!relativeHomePath) {
      continue;
    }

    const galleryJsonPath = path.join(galleryDir, 'gallery', 'gallery.json');
    const galleryData = JSON.parse(await fs.readFile(galleryJsonPath, 'utf8')) as GalleryData;

    galleryData.navigation = {
      ...galleryData.navigation,
      home: {
        label: homeLabel,
        path: `${toUrlPath(relativeHomePath)}/`,
      },
    };

    await fs.writeFile(galleryJsonPath, JSON.stringify(galleryData, null, 2));
  }
}

/**
 * Processes a directory and its subdirectories to create galleries
 * @param scanPath - Path to scan for media files
 * @param outputPath - Path where gallery should be created
 * @param relativeGalleryPath - Gallery directory relative to the initialized root
 * @param baseUrl - Root publication URL shared by all galleries
 * @param recursive - Whether to process subdirectories recursively
 * @param useDefaultSettings - Whether to use default settings or prompt user
 * @param force - Whether to force override existing galleries without prompting
 * @param ctaBanner - Whether to add a Simple Photo Gallery call-to-action banner
 * @param configOptions - CLI options for theme and thumbnail configuration
 * @param ui - ConsolaInstance for logging
 * @returns Promise resolving to processing results
 */
async function processDirectory(
  scanPath: string,
  outputPath: string,
  relativeGalleryPath: string,
  baseUrl: string,
  recursive: boolean,
  useDefaultSettings: boolean,
  force: boolean,
  ctaBanner: boolean | undefined,
  configOptions: InitConfigOptions,
  ui: ConsolaInstance,
): Promise<ProcessDirectoryResult> {
  ui.start(`Scanning ${scanPath}`);

  let totalFiles = 0;
  let totalGalleries = 0;
  const subGalleries: SubGallery[] = [];
  let createdCurrentGallery = false;
  let createdGalleryTitle: string | undefined;

  // Scan current directory for media files
  const { mediaFiles, subGalleryDirectories } = await scanDirectory(scanPath, ui);
  totalFiles += mediaFiles.length;

  // Process subdirectories only if recursive mode is enabled
  if (recursive) {
    for (const subGalleryDir of subGalleryDirectories) {
      const result = await processDirectory(
        subGalleryDir,
        path.join(outputPath, path.basename(subGalleryDir)),
        path.join(relativeGalleryPath, path.basename(subGalleryDir)),
        baseUrl,
        recursive,
        useDefaultSettings,
        force,
        ctaBanner,
        configOptions,
        ui,
      );

      totalFiles += result.totalFiles;
      totalGalleries += result.totalGalleries;

      // If the result contains a valid subGallery, add it to the list
      if (result.subGallery) {
        subGalleries.push(result.subGallery);
      }
    }
  }

  // Create gallery.json if there are media files or subGalleries
  if (mediaFiles.length > 0 || subGalleries.length > 0) {
    const galleryPath = path.join(outputPath, 'gallery');
    const galleryJsonPath = path.join(galleryPath, 'gallery.json');

    // Check if gallery already exists
    const exists = await galleryExists(outputPath);

    if (exists && !force) {
      if (!process.stdout.isTTY) {
        throw new Error(`Gallery already exists at ${galleryJsonPath}. Use --force to overwrite it.`);
      }

      // Ask user if they want to override
      const shouldOverride = await ui.prompt(`Gallery already exists at ${galleryJsonPath}. Do you want to override it?`, {
        type: 'confirm',
        default: false,
      });

      if (!shouldOverride) {
        ui.info('Skipping gallery creation');
        return { totalFiles: totalFiles - mediaFiles.length, totalGalleries };
      }
    }

    try {
      // Create output directory
      await fs.mkdir(galleryPath, { recursive: true });

      const galleryContext = relativeGalleryPath
        ? `sub-gallery: ${toUrlPath(relativeGalleryPath)}`
        : `root: ${path.basename(scanPath)}`;
      const defaultTitle = relativeGalleryPath ? capitalizeTitle(path.basename(scanPath)) : 'My Gallery';

      // Create gallery.json for this directory
      const galleryData = await createGalleryJson(
        mediaFiles,
        galleryJsonPath,
        scanPath,
        subGalleries,
        getGalleryUrl(baseUrl, relativeGalleryPath),
        galleryContext,
        defaultTitle,
        useDefaultSettings,
        ctaBanner,
        configOptions,
        ui,
      );

      createdCurrentGallery = true;
      createdGalleryTitle = galleryData.title;
      totalGalleries += 1;

      ui.success(
        `Created gallery with ${mediaFiles.length} files and ${subGalleries.length} subgalleries at: ${galleryJsonPath}`,
      );
    } catch (error) {
      ui.error(`Error creating gallery.json at ${galleryJsonPath}`);
      throw error;
    }
  }

  // Return result with subgallery info if this directory has media files
  const result: ProcessDirectoryResult = { totalFiles, totalGalleries };

  // If this directory created a gallery, create a subGallery in the result
  if (createdCurrentGallery) {
    const dirName = path.basename(scanPath);
    result.subGallery = {
      title: createdGalleryTitle || capitalizeTitle(dirName),
      headerImage: mediaFiles[0]?.filename || '',
      path: `../${dirName}`,
    };
  }

  return result;
}

/**
 * Main init command implementation - scans directories and creates gallery.json files
 * @param options - Options specifying paths, recursion, and default settings
 * @param ui - ConsolaInstance for logging and user prompts
 */
export async function init(options: ScanOptions, ui: ConsolaInstance): Promise<CommandResultSummary> {
  try {
    const scanPath = path.resolve(options.photos);
    const outputPath = options.gallery ? path.resolve(options.gallery) : scanPath;
    const baseUrl = options.default
      ? ''
      : await ui.prompt(`Enter the base URL for gallery root "${scanPath}" (important for social media images)`, {
          type: 'text',
          default: '',
          placeholder: '',
        });

    // Extract CLI config options for theme and thumbnails
    const configOptions: InitConfigOptions = {
      theme: options.theme,
      thumbnailSize: options.thumbnailSize,
      thumbnailEdge: options.thumbnailEdge,
    };

    // Process the directory tree with the specified recursion setting
    const result = await processDirectory(
      scanPath,
      outputPath,
      '',
      baseUrl,
      options.recursive,
      options.default,
      options.force,
      options.ctaBanner,
      configOptions,
      ui,
    );

    await addHomeNavigation(outputPath);

    ui.box(
      `Created ${result.totalGalleries} ${result.totalGalleries === 1 ? 'gallery' : 'galleries'} with ${result.totalFiles} media ${result.totalFiles === 1 ? 'file' : 'files'}`,
    );

    return {
      processedMediaCount: result.totalFiles,
      processedGalleryCount: result.totalGalleries,
    };
  } catch (error) {
    ui.error('Error initializing gallery');
    throw error;
  }
}
