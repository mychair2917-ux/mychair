import { API_BASE_URL } from '../config/api';

/**
 * Resolves a potentially relative media/file path to a fully qualified URL.
 * If the path is already absolute, empty, or a blob/data URI, it returns it as is.
 * Otherwise, it prepends the origin of API_BASE_URL.
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }

  try {
    const apiOrigin = new URL(API_BASE_URL).origin;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `${apiOrigin.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    }

    const urlObj = new URL(url);
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      return `${apiOrigin.replace(/\/$/, '')}${urlObj.pathname}${urlObj.search}`;
    }

    return url;
  } catch {
    return url;
  }
}
