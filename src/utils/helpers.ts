import { nip19 } from 'nostr-tools';

// Utility functions for the Tagstr application

/**
 * Extracts hashtags from event content
 */
export function extractHashtags(content: string): string[] {
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = content.match(hashtagRegex);
  return matches ? matches.map(tag => tag.slice(1).toLowerCase()) : [];
}

/**
 * Extracts hashtags from event tags array
 */
export function extractHashtagsFromTags(tags: string[][]): string[] {
  return tags
    .filter(tag => tag[0] === 't' && tag[1])
    .map(tag => tag[1].toLowerCase());
}

/**
 * Formats a timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w`;
  return `${Math.floor(diff / 2592000)}mo`;
}

/**
 * Formats a timestamp to readable date
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * Formats a timestamp to readable time
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString();
}

/**
 * Truncates text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Formats large numbers with appropriate suffix
 */
export function formatNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1000000) return (num / 1000).toFixed(1) + 'k';
  if (num < 1000000000) return (num / 1000000).toFixed(1) + 'm';
  return (num / 1000000000).toFixed(1) + 'b';
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Validates a nostr public key
 */
export function isValidPubkey(pubkey: string): boolean {
  return /^[0-9a-f]{64}$/i.test(pubkey);
}

/**
 * Validates a relay URL
 */
export function isValidRelayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'ws:' || parsed.protocol === 'wss:';
  } catch {
    return false;
  }
}

/**
 * Normalizes a relay URL
 */
export function normalizeRelayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

/**
 * Debounces a function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttles a function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number;
  return (...args: Parameters<T>) => {
    if (!lastRan) {
      func(...args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func(...args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

/**
 * Sorts hashtags by various criteria
 */
export function sortHashtags(
  hashtags: { hashtag: string; count: number; lastSeen: number; trending: boolean }[],
  sortBy: 'count' | 'recent' | 'trending' | 'alphabetical',
  direction: 'asc' | 'desc' = 'desc'
) {
  const sorted = [...hashtags].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'count':
        comparison = a.count - b.count;
        break;
      case 'recent':
        comparison = a.lastSeen - b.lastSeen;
        break;
      case 'trending':
        comparison = (a.trending ? 1 : 0) - (b.trending ? 1 : 0);
        if (comparison === 0) comparison = a.count - b.count;
        break;
      case 'alphabetical':
        comparison = a.hashtag.localeCompare(b.hashtag);
        break;
    }

    return direction === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

/**
 * Calculates trending hashtags based on recent activity
 */
export function calculateTrending(
  hashtags: { hashtag: string; count: number; lastSeen: number }[],
  timeWindow: number = 3600 // 1 hour in seconds
): string[] {
  const now = Date.now() / 1000;
  const cutoff = now - timeWindow;

  return hashtags
    .filter(h => h.lastSeen > cutoff)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(h => h.hashtag);
}

/**
 * Formats bytes to human readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Escapes HTML entities
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Converts hex pubkey to npub format
 */
export function hexToNpub(hex: string): string {
  try {
    return nip19.npubEncode(hex);
  } catch (e) {
    console.error(`Failed to encode npub: ${e}`);
    return 'invalid npub';
  }
}

/**
 * Converts hex pubkey to a short npub format for display
 */
export function hexToShortNpub(hex: string): string {
  try {
    const npub = nip19.npubEncode(hex);
    return `${npub.slice(0, 12)}...${npub.slice(-4)}`;
  } catch (e) {
    return 'invalid npub';
  }
}

/**
 * Gets the color for a hashtag based on its hash
 */
export function getHashtagColor(hashtag: string): string {
  const colors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e'
  ];

  let hash = 0;
  for (let i = 0; i < hashtag.length; i++) {
    hash = hashtag.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
