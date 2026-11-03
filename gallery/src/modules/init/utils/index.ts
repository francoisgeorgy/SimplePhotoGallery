import { promises as fs } from 'node:fs';
import path from 'node:path';

import { toUrlPath } from '@simple-photo-gallery/common/theme';

import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../../../config';

import type { InitConfigFile, MediaFileType } from '../types';

/**
 * Determines the media file type based on file extension
 * @param fileName - Name of the file to check
 * @returns Media file type ('image' or 'video') or null if not supported
 */
export function getMediaFileType(fileName: string): MediaFileType | null {
  const ext = path.extname(fileName).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return null;
}

/**
 * Converts a folder name into a properly capitalized title
 * @param folderName - The folder name to convert
 * @returns Formatted title with proper capitalization
 */
export function capitalizeTitle(folderName: string): string {
  return folderName
    .replaceAll(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalizes an album folder path for matching against relative gallery paths
 * @param folder - Folder path to normalize
 * @returns Normalized folder path with forward slashes and no leading/trailing slashes
 */
export function normalizeAlbumPath(folder: string): string {
  const normalized = toUrlPath(path.normalize(folder.trim()));
  return normalized.replaceAll(/^\.\/?|^\/+|\/+$/g, '');
}

/**
 * Parses the content of an init text config file
 * @param content - Text content of the config file
 * @param resolvedConfigPath - Optional path of the config file for error messages
 * @returns Parsed InitConfigFile object
 */
export function parseInitConfig(content: string, resolvedConfigPath?: string): InitConfigFile {
  const config: InitConfigFile = { albums: {} };
  let parsingAlbums = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    if (/^albums\b/i.test(line)) {
      parsingAlbums = true;
      continue;
    }

    if (parsingAlbums) {
      const parts = line.split(':');
      const folder = parts[0]?.trim();
      const title = parts[1]?.trim();
      const description = parts.slice(2).join(':').trim();

      if (!folder || !title) {
        throw new Error(
          `Invalid album line in ${resolvedConfigPath || 'config'}: "${line}". Expected "folder : title : description".`,
        );
      }

      config.albums[normalizeAlbumPath(folder)] = { folder, title, description };
      continue;
    }

    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();

    if (!key || !value) {
      continue;
    }

    switch (key.trim().toLowerCase()) {
      case 'base folder':
      case 'basefolder':
      case 'photos': {
        config.baseFolder = value;
        break;
      }
      case 'title': {
        config.title = value;
        break;
      }
      case 'description': {
        config.description = value;
        break;
      }
      case 'url':
      case 'base url':
      case 'baseurl': {
        config.url = value;
        break;
      }
      case 'cloudflare':
      case 'cloudflare analytics':
      case 'cloudflareanalytics': {
        const lower = value.toLowerCase();
        config.cloudflare = lower === 'true' || lower === 'yes' || lower === '1';
        break;
      }
    }
  }

  return config;
}

/**
 * Loads and parses an init config file from disk
 * @param configPath - Path to the config file
 * @returns Promise resolving to parsed InitConfigFile
 */
export async function loadInitConfig(configPath: string): Promise<InitConfigFile> {
  const resolvedPath = path.resolve(configPath);
  const content = await fs.readFile(resolvedPath, 'utf8');
  return parseInitConfig(content, resolvedPath);
}
