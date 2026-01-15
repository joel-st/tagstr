// Relay discovery utilities focused on NIP-65 and NIP-19 standards
import { NostrEvent } from '../types';
import { isValidRelayUrl, normalizeRelayUrl } from './helpers';

/**
 * NIP-65 Relay List Metadata (Kind 10002) parser
 */
export interface RelayListEntry {
  url: string;
  read: boolean;
  write: boolean;
  source: 'nip65' | 'nip19' | 'legacy';
  pubkey: string;
  timestamp: number;
}

/**
 * Extract relay information from NIP-65 Kind 10002 events
 */
export function parseNip65RelayList(event: NostrEvent): RelayListEntry[] {
  if (event.kind !== 10002) {
    return [];
  }

  const relayEntries: RelayListEntry[] = [];

  event.tags.forEach(tag => {
    if (tag[0] === 'r' && tag[1] && isValidRelayUrl(tag[1])) {
      const url = normalizeRelayUrl(tag[1]);
      const marker = tag[2]; // Optional read/write marker
      
      let read = true;
      let write = true;

      // Parse the read/write marker
      if (marker === 'read') {
        read = true;
        write = false;
      } else if (marker === 'write') {
        read = false;
        write = true;
      }
      // If no marker is specified, assume both read and write

      relayEntries.push({
        url,
        read,
        write,
        source: 'nip65',
        pubkey: event.pubkey,
        timestamp: event.created_at
      });
    }
  });

  return relayEntries;
}

/**
 * NIP-19 bech32 entity decoder for relay hints
 */
export interface Nip19Entity {
  type: 'nprofile' | 'nevent' | 'naddr';
  data: string; // pubkey, event id, etc.
  relays: string[];
}

/**
 * Simple NIP-19 decoder focused on extracting relay hints
 * This is a simplified implementation - in production you'd use nostr-tools
 */
export function parseNip19RelayHints(bech32String: string): string[] {
  const relays: string[] = [];
  
  try {
    // Check if it's a NIP-19 entity (starts with n...)
    if (!bech32String.startsWith('n')) {
      return relays;
    }

    // For now, we'll do a simple regex extraction of URLs from the decoded content
    // In a real implementation, you'd use proper bech32 decoding from nostr-tools
    const urlMatches = bech32String.match(/wss?:\/\/[a-zA-Z0-9.-]+(?::[0-9]+)?(?:\/[^\s]*)?/g);
    
    if (urlMatches) {
      urlMatches.forEach(url => {
        const cleanUrl = url.replace(/[.,;:!?)]$/, ''); // Remove trailing punctuation
        if (isValidRelayUrl(cleanUrl)) {
          relays.push(normalizeRelayUrl(cleanUrl));
        }
      });
    }
  } catch (error) {
    console.warn('Error parsing NIP-19 entity:', error);
  }

  return relays;
}

/**
 * Extract relay hints from event content that might contain NIP-19 entities
 */
export function extractNip19RelayHints(content: string): string[] {
  const relays = new Set<string>();
  
  // Find all NIP-19 entities in the content
  const nip19Matches = content.match(/n(profile|event|addr)1[a-z0-9]+/g);
  
  if (nip19Matches) {
    nip19Matches.forEach(entity => {
      const hints = parseNip19RelayHints(entity);
      hints.forEach(relay => relays.add(relay));
    });
  }

  return Array.from(relays);
}

/**
 * Relay discovery configuration focused on NIP standards
 */
export interface StandardRelayDiscoveryConfig {
  maxRelays: number;
  minFolloweeRecommendations: number; // How many followees must recommend a relay
  nip65Enabled: boolean;
  nip19Enabled: boolean;
  followContactRelays: boolean; // Follow relays from Kind 3 contact events
  blacklistedDomains: string[];
  preferredDomains: string[];
  maxAgeHours: number; // Max age for relay recommendations
}

export const defaultStandardConfig: StandardRelayDiscoveryConfig = {
  maxRelays: 15,
  minFolloweeRecommendations: 2,
  nip65Enabled: true,
  nip19Enabled: true,
  followContactRelays: true,
  blacklistedDomains: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    'test.local',
    'example.com',
    '192.168.',
    '10.0.',
    '172.16.'
  ],
  preferredDomains: [
    'relay.damus.io',
    'nos.lol',
    'relay.primal.net',
    'relay.nostr.band',
    'nostr.wine',
    'relay.snort.social',
    'nostr-pub.wellorder.net',
    'relay.current.fyi'
  ],
  maxAgeHours: 720 // 30 days
};

/**
 * Standard relay discovery manager following NIP-65 and NIP-19
 */
export class StandardRelayDiscovery {
  private relayRecommendations = new Map<string, {
    readRecommendations: Set<string>; // pubkeys that recommend for reading
    writeRecommendations: Set<string>; // pubkeys that recommend for writing
    lastSeen: number;
    sources: ('nip65' | 'nip19' | 'contacts')[];
  }>();
  
  private followedPubkeys = new Set<string>();
  private config: StandardRelayDiscoveryConfig;

  constructor(config: StandardRelayDiscoveryConfig = defaultStandardConfig) {
    this.config = { ...config };
  }

  /**
   * Process a NIP-65 relay list event
   */
  processNip65Event(event: NostrEvent): string[] {
    if (!this.config.nip65Enabled || event.kind !== 10002) {
      return [];
    }

    const relayEntries = parseNip65RelayList(event);
    const newRelays: string[] = [];

    relayEntries.forEach(entry => {
      if (this.isBlacklisted(entry.url)) {
        return;
      }

      const existing = this.relayRecommendations.get(entry.url) || {
        readRecommendations: new Set(),
        writeRecommendations: new Set(),
        lastSeen: 0,
        sources: []
      };

      // Add recommendations based on read/write markers
      if (entry.read) {
        existing.readRecommendations.add(entry.pubkey);
      }
      if (entry.write) {
        existing.writeRecommendations.add(entry.pubkey);
      }

      existing.lastSeen = Math.max(existing.lastSeen, entry.timestamp * 1000);
      
      if (!existing.sources.includes('nip65')) {
        existing.sources.push('nip65');
      }

      this.relayRecommendations.set(entry.url, existing);

      // Check if this relay now meets our threshold
      const totalRecs = existing.readRecommendations.size + existing.writeRecommendations.size;
      if (totalRecs >= this.config.minFolloweeRecommendations) {
        newRelays.push(entry.url);
      }
    });

    return newRelays;
  }

  /**
   * Process NIP-19 relay hints from event content
   */
  processNip19Hints(event: NostrEvent): string[] {
    if (!this.config.nip19Enabled) {
      return [];
    }

    const hints = extractNip19RelayHints(event.content);
    const newRelays: string[] = [];

    hints.forEach(relayUrl => {
      if (this.isBlacklisted(relayUrl)) {
        return;
      }

      const existing = this.relayRecommendations.get(relayUrl) || {
        readRecommendations: new Set(),
        writeRecommendations: new Set(),
        lastSeen: 0,
        sources: []
      };

      // NIP-19 hints are usually for reading
      existing.readRecommendations.add(event.pubkey);
      existing.lastSeen = Math.max(existing.lastSeen, event.created_at * 1000);
      
      if (!existing.sources.includes('nip19')) {
        existing.sources.push('nip19');
      }

      this.relayRecommendations.set(relayUrl, existing);

      const totalRecs = existing.readRecommendations.size + existing.writeRecommendations.size;
      if (totalRecs >= this.config.minFolloweeRecommendations) {
        newRelays.push(relayUrl);
      }
    });

    return newRelays;
  }

  /**
   * Process Kind 3 contact events for relay information
   */
  processContactEvent(event: NostrEvent): string[] {
    if (!this.config.followContactRelays || event.kind !== 3) {
      return [];
    }

    const newRelays: string[] = [];

    // Extract followed pubkeys for future reference
    event.tags.forEach(tag => {
      if (tag[0] === 'p' && tag[1]) {
        this.followedPubkeys.add(tag[1]);
      }
    });

    // Look for relay URLs in the content (legacy format)
    try {
      const content = JSON.parse(event.content);
      if (content && typeof content === 'object') {
        Object.entries(content).forEach(([pubkey, relayInfo]: [string, any]) => {
          if (relayInfo && typeof relayInfo === 'object' && relayInfo.relay) {
            const relayUrl = relayInfo.relay;
            if (isValidRelayUrl(relayUrl) && !this.isBlacklisted(relayUrl)) {
              const normalized = normalizeRelayUrl(relayUrl);
              
              const existing = this.relayRecommendations.get(normalized) || {
                readRecommendations: new Set(),
                writeRecommendations: new Set(),
                lastSeen: 0,
                sources: []
              };

              existing.readRecommendations.add(event.pubkey);
              existing.lastSeen = Math.max(existing.lastSeen, event.created_at * 1000);
              
              if (!existing.sources.includes('contacts')) {
                existing.sources.push('contacts');
              }

              this.relayRecommendations.set(normalized, existing);

              const totalRecs = existing.readRecommendations.size + existing.writeRecommendations.size;
              if (totalRecs >= this.config.minFolloweeRecommendations) {
                newRelays.push(normalized);
              }
            }
          }
        });
      }
    } catch {
      // Not valid JSON, skip
    }

    return newRelays;
  }

  /**
   * Get all discovered relays that meet the threshold
   */
  getRecommendedRelays(): Array<{
    url: string;
    readRecs: number;
    writeRecs: number;
    totalRecs: number;
    lastSeen: number;
    sources: string[];
    score: number;
  }> {
    const now = Date.now();
    const maxAge = this.config.maxAgeHours * 60 * 60 * 1000;

    return Array.from(this.relayRecommendations.entries())
      .filter(([url, data]) => {
        // Remove old entries
        if (now - data.lastSeen > maxAge) {
          this.relayRecommendations.delete(url);
          return false;
        }
        
        const totalRecs = data.readRecommendations.size + data.writeRecommendations.size;
        return totalRecs >= this.config.minFolloweeRecommendations;
      })
      .map(([url, data]) => {
        const readRecs = data.readRecommendations.size;
        const writeRecs = data.writeRecommendations.size;
        const totalRecs = readRecs + writeRecs;
        
        // Calculate score with bonuses
        let score = totalRecs;
        if (this.isPreferredDomain(url)) score += 10;
        if (data.sources.includes('nip65')) score += 5;
        if (data.sources.includes('nip19')) score += 2;
        
        return {
          url,
          readRecs,
          writeRecs,
          totalRecs,
          lastSeen: data.lastSeen,
          sources: [...data.sources],
          score
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxRelays);
  }

  /**
   * Check if URL is blacklisted
   */
  private isBlacklisted(relayUrl: string): boolean {
    try {
      const url = new URL(relayUrl);
      return this.config.blacklistedDomains.some(domain => 
        url.hostname === domain || 
        url.hostname.endsWith('.' + domain) ||
        url.hostname.startsWith(domain)
      );
    } catch {
      return true;
    }
  }

  /**
   * Check if URL is from preferred domain
   */
  private isPreferredDomain(relayUrl: string): boolean {
    try {
      const url = new URL(relayUrl);
      return this.config.preferredDomains.some(domain => 
        url.hostname === domain || url.hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  }

  /**
   * Get discovery statistics
   */
  getStats(): {
    totalDiscovered: number;
    recommendedRelays: number;
    nip65Events: number;
    nip19Hints: number;
    contactEvents: number;
    followedUsers: number;
  } {
    const recommended = this.getRecommendedRelays();
    let nip65Count = 0, nip19Count = 0, contactCount = 0;

    this.relayRecommendations.forEach(data => {
      if (data.sources.includes('nip65')) nip65Count++;
      if (data.sources.includes('nip19')) nip19Count++;
      if (data.sources.includes('contacts')) contactCount++;
    });

    return {
      totalDiscovered: this.relayRecommendations.size,
      recommendedRelays: recommended.length,
      nip65Events: nip65Count,
      nip19Hints: nip19Count,
      contactEvents: contactCount,
      followedUsers: this.followedPubkeys.size
    };
  }

  /**
   * Export discovery data for persistence
   */
  exportData(): any {
    return {
      relayRecommendations: Array.from(this.relayRecommendations.entries()).map(([url, data]) => ({
        url,
        readRecommendations: Array.from(data.readRecommendations),
        writeRecommendations: Array.from(data.writeRecommendations),
        lastSeen: data.lastSeen,
        sources: data.sources
      })),
      followedPubkeys: Array.from(this.followedPubkeys),
      config: this.config
    };
  }

  /**
   * Import discovery data from persistence
   */
  importData(data: any): void {
    if (data.relayRecommendations && Array.isArray(data.relayRecommendations)) {
      this.relayRecommendations.clear();
      data.relayRecommendations.forEach((entry: any) => {
        if (entry.url && entry.readRecommendations && entry.writeRecommendations) {
          this.relayRecommendations.set(entry.url, {
            readRecommendations: new Set(entry.readRecommendations),
            writeRecommendations: new Set(entry.writeRecommendations),
            lastSeen: entry.lastSeen || 0,
            sources: entry.sources || []
          });
        }
      });
    }

    if (data.followedPubkeys && Array.isArray(data.followedPubkeys)) {
      this.followedPubkeys = new Set(data.followedPubkeys);
    }

    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
  }

  /**
   * Cleanup old entries
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = this.config.maxAgeHours * 60 * 60 * 1000;

    for (const [url, data] of this.relayRecommendations.entries()) {
      if (now - data.lastSeen > maxAge) {
        this.relayRecommendations.delete(url);
      }
    }
  }
}

// Global instance
export const standardRelayDiscovery = new StandardRelayDiscovery();