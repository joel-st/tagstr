export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface HashtagCount {
  hashtag: string;
  count: number;
  lastSeen: number;
  trending: boolean;
}

export interface RelayMetrics {
  url: string;
  connected: boolean;
  connectionTime: number;
  eventsReceived: number;
  lastEventTime: number;
  latency: number;
  errors: number;
  subscriptions: number;
  error?: string;
}

export interface Relay {
  url: string;
  enabled: boolean;
  read: boolean;
  write: boolean;
  metrics: RelayMetrics;
}

export interface EventFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
  '#t'?: string[];
}

export interface AppSettings {
  theme: 'wireframe' | 'dark' | 'light';
  autoRefresh: boolean;
  refreshInterval: number;
  maxEvents: number;
  defaultSort: 'count' | 'recent' | 'trending';
  relaySettings: {
    autoDiscover: boolean;
    maxRelays: number;
    timeout: number;
    minTrustScore: number;
    trustDecayHours: number;
    discoveryInterval: number;
  };
}

export interface HashtagInsights {
  hashtag: string;
  totalEvents: number;
  uniqueAuthors: number;
  relatedTags: { tag: string; count: number }[];
  topAuthors: { pubkey: string; count: number; profile?: UserProfile }[];
  relayDistribution: { relay: string; count: number }[];
  timeDistribution: { timestamp: number; count: number }[];
}

export interface UserProfile {
  pubkey: string;
  name?: string;
  display_name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  banner?: string;
  website?: string;
}

export interface AppStats {
  eventsReceived: number;
  uniqueHashtags: number;
  activeRelays: number;
  lastUpdate: number;
  uptime: number;
}

export interface SortOption {
  key: 'count' | 'recent' | 'trending' | 'alphabetical';
  label: string;
  direction: 'asc' | 'desc';
}

export type PanelType = 'relay' | null;

export interface EventSubscription {
  id: string;
  filters: EventFilter[];
  relays: string[];
  active: boolean;
  createdAt: number;
}

export interface LocalStorage {
  settings: AppSettings;
  relays: Relay[];
  events: NostrEvent[];
  hashtags: HashtagCount[];
  profiles: Record<string, UserProfile>;
}