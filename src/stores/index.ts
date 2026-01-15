import { createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { AppSettings, Relay, HashtagCount, UserProfile, PanelType, SortOption, EventFilter } from '../types';
import { storageService } from '../services/storage';
import { sortHashtags, formatNumber } from '../utils/helpers';

// Settings Store (uses localStorage)
const [settings, setSettings] = createStore<AppSettings>(storageService.getSettings());

export const settingsStore = {
  settings,
  updateSettings: (updates: Partial<AppSettings>) => {
    setSettings(produce(s => Object.assign(s, updates)));
    storageService.saveSettings({ ...settings, ...updates });
  },
  resetSettings: () => {
    const defaultSettings = storageService.getSettings();
    setSettings(defaultSettings);
    storageService.saveSettings(defaultSettings);
  }
};

// Relays Store
const [relays, setRelays] = createStore<Relay[]>([]);

export const relaysStore = {
  relays,
  setRelays: (newRelays: Relay[]) => {
    setRelays(newRelays);
  },
  reset: () => setRelays([]),
  get activeRelays() {
    return relays.filter(r => r.enabled && r.metrics.connected);
  },
  get enabledRelays() {
    return relays.filter(r => r.enabled);
  }
};

// Hashtags Store
const [hashtags, setHashtags] = createStore<HashtagCount[]>([]);
const [selectedHashtag, setSelectedHashtag] = createSignal<string | null>(null);

export const hashtagsStore = {
  hashtags,
  selectedHashtag,
  setSelectedHashtag,
  reset: () => {
    setHashtags([]);
    setSelectedHashtag(null);
  },
  get trendingHashtags() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    return hashtags.filter(h => 
      h.trending || 
      (h.lastSeen > now - oneHour && h.count > 5)
    );
  },
  updateHashtagCount: (hashtag: string, createdAt: number, increment: number = 1) => {
    setHashtags(produce(hashtags => {
      const existing = hashtags.find(h => h.hashtag === hashtag);
      if (existing) {
        existing.count += increment;
        if (createdAt * 1000 > existing.lastSeen) {
          existing.lastSeen = createdAt * 1000;
        }
      } else {
        hashtags.push({
          hashtag,
          count: increment,
          lastSeen: createdAt * 1000,
          trending: false
        });
      }
    }));
    // Update stats after hashtag count change
    statsStore.setStat('uniqueHashtags', hashtags.length);
  },
  getSortedHashtags: (sortBy: SortOption['key'], direction: SortOption['direction'] = 'desc') => {
    return sortHashtags([...hashtags], sortBy, direction);
  },
  get totalHashtags() {
    return hashtags.length;
  },
  get totalCounts() {
    return hashtags.reduce((sum, h) => sum + h.count, 0);
  },
};

// Profiles Store
const [profiles, setProfiles] = createStore<Record<string, UserProfile>>({});

export const profilesStore = {
  profiles,
  getProfile: (pubkey: string) => {
    return profiles[pubkey];
  },
  setProfile: (profile: UserProfile) => {
    setProfiles(produce(profiles => {
      profiles[profile.pubkey] = profile;
    }));
  },
  reset: () => setProfiles({}),
};

// UI Store
const [activePanel, setActivePanel] = createSignal<PanelType>(null);
const [searchQuery, setSearchQuery] = createSignal('');
const [currentSort, setCurrentSort] = createSignal<SortOption>({
  key: settings.defaultSort,
  label: 'Count',
  direction: 'desc'
});
const [eventFilter, setEventFilter] = createSignal<EventFilter>({});
const [isLoading, setIsLoading] = createSignal(false);

export const uiStore = {
  activePanel,
  setActivePanel,
  searchQuery,
  setSearchQuery,
  currentSort,
  setCurrentSort,
  eventFilter,
  setEventFilter,
  isLoading,
  setIsLoading,
  togglePanel: (panel: PanelType) => {
    setActivePanel(current => current === panel ? null : panel);
  },
  closePanel: () => {
    setActivePanel(null);
  }
};

// Stats Store
const [stats, setStats] = createStore({
  eventsReceived: 0,
  uniqueHashtags: 0,
  activeRelays: 0,
  uptime: 0,
  lastUpdate: 0
});

export const statsStore = {
  stats,
  setStat: (key: keyof typeof stats, value: number) => {
    setStats(produce(s => {
      s[key] = value;
    }));
  },
  reset: () => setStats({ eventsReceived: 0, uniqueHashtags: 0, activeRelays: 0, uptime: 0, lastUpdate: 0 }),
  get formattedStats() {
    return {
      eventsReceived: formatNumber(stats.eventsReceived),
      uniqueHashtags: formatNumber(stats.uniqueHashtags),
      activeRelays: stats.activeRelays.toString(),
      uptime: Math.floor(stats.uptime / 1000 / 60), // minutes
      lastUpdate: stats.lastUpdate
    };
  }
};

// Export all stores as a single object for convenience
export const stores = {
  settings: settingsStore,
  relays: relaysStore,
  hashtags: hashtagsStore,
  profiles: profilesStore,
  ui: uiStore,
  stats: statsStore,
};

// Filtered hashtags based on search and sort
export const getFilteredHashtags = () => {
  const query = stores.ui.searchQuery().toLowerCase();
  const sort = stores.ui.currentSort();
  
  // Defensive check to ensure hashtags array exists
  if (!stores.hashtags.hashtags || !Array.isArray(stores.hashtags.hashtags)) {
    return [];
  }
  
  let filtered = [...stores.hashtags.hashtags];
  
  if (query) {
    filtered = filtered.filter(h => 
      h.hashtag.toLowerCase().includes(query)
    );
  }
  
  return sortHashtags(filtered, sort.key, sort.direction);
};
