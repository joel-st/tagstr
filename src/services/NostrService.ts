import { EventStore } from 'applesauce-core';
import { RelayPool, onlyEvents } from 'applesauce-relay';
import { createEventLoader, createAddressLoader } from 'applesauce-loaders/loaders';
import { BehaviorSubject, merge, timer, takeUntil, catchError, EMPTY, of, switchMap, tap } from 'rxjs';
// Define basic types since they're not exported from applesauce-core
interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface Filter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  [key: string]: any;
}

export interface RelayStatus {
  url: string;
  connected: boolean;
  eventsReceived: number;
  lastActivity?: Date;
  error?: string;
}

export interface EventsByKind {
  [kind: number]: number;
}

const since = Math.floor((Date.now() / 1000) - 1800); // 1h

export class NostrService {
  private eventStore: EventStore;
  private pool: RelayPool;
  private eventLoader: any;
  private addressLoader: any;

  // Default relays as specified in requirements
  private defaultRelays = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band',
    'wss://relay.snort.social',
    'wss://relay.primal.net',
    'wss://nostr.mom'
  ];

  // Observable subjects for reactive state
  public relayStatuses$ = new BehaviorSubject<Map<string, RelayStatus>>(new Map());
  public eventsByKind$ = new BehaviorSubject<EventsByKind>({});
  public totalEvents$ = new BehaviorSubject<number>(0);
  public dbQuota$ = new BehaviorSubject<{ used: number; total: number }>({ used: 0, total: 0 });
  public events$ = new BehaviorSubject<NostrEvent | null>(null);

  private relayStatuses = new Map<string, RelayStatus>();
  private eventCounts: EventsByKind = {};
  private hashtagEvents = new Map<string, NostrEvent[]>(); // Track events by hashtag
  private hashtagRelayDistribution = new Map<string, Map<string, number>>(); // Track relay distribution per hashtag
  private stopCleanup$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.eventStore = new EventStore();
    this.pool = new RelayPool();

    // Initialize loaders
    this.eventLoader = createEventLoader(this.pool, {
      eventStore: this.eventStore,
      extraRelays: this.defaultRelays,
    });

    this.addressLoader = createAddressLoader(this.pool, {
      eventStore: this.eventStore,
      extraRelays: this.defaultRelays,
    });

    this.initializeRelayStatuses();
    this.startEventSubscriptions();
    this.startCleanupTimer();
    this.updateDbQuota();
  }

  private initializeRelayStatuses() {
    this.defaultRelays.forEach(url => {
      this.relayStatuses.set(url, {
        url,
        connected: false,
        eventsReceived: 0
      });
    });
    this.relayStatuses$.next(new Map(this.relayStatuses));
  }

  private startEventSubscriptions() {
    // Subscribe to events from all default relays
    const subscriptions = this.defaultRelays.map(relayUrl => {
      return this.pool
        .relay(relayUrl)
        .subscription({
          kinds: [0, 1, 20, 21, 22, 10002, 1063],
          since: since // Profile, Notes, Contacts, Relay List, File Metadata
        })
        .pipe(
          onlyEvents(),
          tap(event => this.handleEvent(event, relayUrl)),
          catchError(error => {
            console.error(`Relay ${relayUrl} error:`, error);
            this.updateRelayStatus(relayUrl, false, error.message);
            return EMPTY;
          })
        );
    });

    // Merge all relay subscriptions
    merge(...subscriptions).subscribe({
      next: (event) => {
        this.eventStore.add(event);
        this.updateEventCounts(event);
        this.trackHashtagEvents(event);
        this.updateDbQuota();
        this.events$.next(event);
      },
      error: (error) => {
        console.error('Subscription error:', error);
      }
    });
  }

  private handleEvent(event: NostrEvent, relayUrl: string) {
    // Update relay status
    this.updateRelayStatus(relayUrl, true);

    // Track hashtag relay distribution
    this.trackHashtagRelayDistribution(event, relayUrl);

    // Handle KIND 1 events (notes) - fetch user profiles
    if (event.kind === 1) {
      this.fetchUserProfile(event.pubkey);
    }

    // Handle KIND 0 events (profiles) - fetch relay lists
    if (event.kind === 0) {
      this.fetchUserRelayList(event.pubkey);
    }
  }

  private updateRelayStatus(relayUrl: string, connected: boolean, error?: string) {
    const status = this.relayStatuses.get(relayUrl);
    if (status) {
      status.connected = connected;
      if (connected) {
        status.eventsReceived += 1;
        status.lastActivity = new Date();
        status.error = undefined;
      } else if (error) {
        status.error = error;
      }
      this.relayStatuses.set(relayUrl, status);
      this.relayStatuses$.next(new Map(this.relayStatuses));
    }
  }

    private trackHashtagEvents(event: NostrEvent) {
      // Extract hashtags from tags
      const hashtags = event.tags
        .filter(tag => tag[0] === 't' && tag[1])
        .map(tag => tag[1].toLowerCase());

      // Store event for each hashtag
      hashtags.forEach(hashtag => {
        if (!this.hashtagEvents.has(hashtag)) {
          this.hashtagEvents.set(hashtag, []);
        }
        const events = this.hashtagEvents.get(hashtag)!;

        // Check for duplicates before adding
        if (!events.some(e => e.id === event.id)) {
          events.unshift(event); // Add to front for chronological order
        }

        // Keep only last 100 events per hashtag to avoid memory issues
        if (events.length > 100) {
          events.splice(100);
        }
      });
    }
  private trackHashtagRelayDistribution(event: NostrEvent, relayUrl: string) {
    // Extract hashtags from tags
    const hashtags = event.tags
      .filter(tag => tag[0] === 't' && tag[1])
      .map(tag => tag[1].toLowerCase());

    // Track relay distribution for each hashtag
    hashtags.forEach(hashtag => {
      if (!this.hashtagRelayDistribution.has(hashtag)) {
        this.hashtagRelayDistribution.set(hashtag, new Map());
      }
      const relayDist = this.hashtagRelayDistribution.get(hashtag)!;
      relayDist.set(relayUrl, (relayDist.get(relayUrl) || 0) + 1);
    });
  }

  private updateEventCounts(event: NostrEvent) {
    this.eventCounts[event.kind] = (this.eventCounts[event.kind] || 0) + 1;
    this.eventsByKind$.next({ ...this.eventCounts });

    const totalEvents = Object.values(this.eventCounts).reduce((sum, count) => sum + count, 0);
    this.totalEvents$.next(totalEvents);
  }

  private fetchUserProfile(pubkey: string) {
    // Check if we already have the profile
    const existingProfile = this.eventStore.getReplaceable(0, pubkey);
    if (existingProfile) return;

    // Load user profile (KIND 0)
    this.addressLoader({
      kind: 0,
      pubkey,
      relays: this.defaultRelays
    }).pipe(
      catchError(error => {
        console.error('Error fetching profile for', pubkey, error);
        return EMPTY;
      })
    ).subscribe();
  }

  private fetchUserRelayList(pubkey: string) {
    // Load user relay list (KIND 10002)
    this.addressLoader({
      kind: 10002,
      pubkey,
      relays: this.defaultRelays
    }).pipe(
      catchError(error => {
        console.error('Error fetching relay list for', pubkey, error);
        return EMPTY;
      }),
      tap((relayListEvent: NostrEvent) => {
        if (relayListEvent) {
          this.processRelayListEvent(relayListEvent);
        }
      })
    ).subscribe();
  }

  private processRelayListEvent(event: NostrEvent) {
    // Parse relay list from tags and discover new relays
    const relayTags = event.tags.filter((tag: string[]) => tag[0] === 'r' && tag[1]);
    const newRelays = relayTags
      .map((tag: string[]) => tag[1])
      .filter((url: string) => !this.relayStatuses.has(url));

    // Auto-connect to new relays
    if (newRelays.length > 0) {
      newRelays.forEach((url: string) => {
        this.connectToRelay(url);
      });
    }
  }

  private startCleanupTimer() {
    // Clean up events older than 1 hour every 10 minutes
    timer(0, 10 * 60 * 1000)
      .pipe(
        takeUntil(this.stopCleanup$),
        switchMap(() => of(this.cleanupOldEvents()))
      )
      .subscribe();
  }

  private cleanupOldEvents() {
    const oneHourAgo = Math.floor(Date.now() / 1000) - 86400; // 1 hour in seconds

    // Get all events and filter out old ones
    // Note: EventStore doesn't have a dumpFilters method in the current version
    // This is a conceptual implementation - in practice you'd need to track events separately
    // or use applesauce-sqlite for persistence with cleanup capabilities
    const conceptualEventCount = this.totalEvents$.value;
    const estimatedOldEvents = Math.max(0, conceptualEventCount - 1000); // Keep last 1000 events

    // Conceptually remove old events
    for (let i = 0; i < estimatedOldEvents; i++) {
      // Conceptually remove - would need custom implementation
      console.log(`Would remove old event #${i}`);
    }

    // Update quota after cleanup
    this.updateDbQuota();

    return estimatedOldEvents;
  }

  private updateDbQuota() {
    // Calculate more realistic memory usage
    const totalEvents = this.totalEvents$.value;
    const hashtagEventsSize = Array.from(this.hashtagEvents.values())
      .reduce((total, events) => total + events.length, 0);

    // More realistic size estimates:
    // - Basic event: ~300 bytes (id, pubkey, timestamp, kind, sig)
    // - Content: average ~200 bytes
    // - Tags: average ~100 bytes per event
    // - Profile data: ~500 bytes per profile
    // - Hashtag tracking overhead: ~50 bytes per hashtag per event

    const eventDataSize = totalEvents * 600; // 600 bytes per event average
    const profilesSize = 0; // Profile size estimation - would need proper eventStore access
    const hashtagOverhead = hashtagEventsSize * 50; // Hashtag tracking overhead
    const relayStatusSize = this.relayStatuses.size * 200; // Relay status data

    const totalUsed = eventDataSize + profilesSize + hashtagOverhead + relayStatusSize;

    // More realistic browser memory quota estimate
    const totalQuota = 150 * 1024 * 1024; // 150MB estimate

    this.dbQuota$.next({
      used: Math.max(totalUsed, 1024), // Minimum 1KB to show some usage
      total: totalQuota
    });
  }

  // Public methods for component interaction
  public getEventStore(): EventStore {
    return this.eventStore;
  }

  public getRelayPool(): RelayPool {
    return this.pool;
  }

  public connectToRelay(relayUrl: string) {
    if (!this.relayStatuses.has(relayUrl)) {
      this.relayStatuses.set(relayUrl, {
        url: relayUrl,
        connected: false,
        eventsReceived: 0
      });
    }

    // Start subscription to new relay
    this.pool
      .relay(relayUrl)
      .subscription({
        kinds: [0, 1, 20, 21, 22, 10002, 1063],
        since: since
      })
      .pipe(
        onlyEvents(),
        tap(event => this.handleEvent(event, relayUrl)),
        catchError(error => {
          console.error(`New relay ${relayUrl} error:`, error);
          this.updateRelayStatus(relayUrl, false, error.message);
          return EMPTY;
        })
      )
      .subscribe(event => {
        this.eventStore.add(event);
        this.updateEventCounts(event);
        this.trackHashtagEvents(event);
        this.updateDbQuota();
        this.events$.next(event);
      });
  }

  public disconnect() {
    this.stopCleanup$.next(true);
  }

  public removeRelay(url: string) {
    this.pool.remove(url);
    this.relayStatuses.delete(url);
    this.relayStatuses$.next(new Map(this.relayStatuses));
  }

  public getHashtagEvents(hashtag: string): NostrEvent[] {
    return this.hashtagEvents.get(hashtag.toLowerCase()) || [];
  }

  public getAllHashtagEvents(): Map<string, NostrEvent[]> {
    return new Map(this.hashtagEvents);
  }

  public getHashtagRelayDistribution(hashtag: string): { relay: string; count: number }[] {
    const distribution = this.hashtagRelayDistribution.get(hashtag.toLowerCase());
    if (!distribution) return [];

    return Array.from(distribution.entries()).map(([relay, count]) => ({ relay, count }));
  }
}
