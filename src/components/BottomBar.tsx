import { Component, createEffect, createSignal } from 'solid-js';
import { stores } from '../stores';
import { formatRelativeTime, formatNumber, formatBytes } from '../utils/helpers';
import { NostrService } from '../services/NostrService';

interface BottomBarProps {
  nostrService?: NostrService;
}

const BottomBar: Component<BottomBarProps> = (props) => {
  const [uptime, setUptime] = createSignal(0);
  const [storageInfo, setStorageInfo] = createSignal({ used: 0, total: 0 });

  // Update uptime every second
  createEffect(() => {
    const interval = setInterval(() => {
      setUptime(Math.floor((Date.now() - (Date.now() - stores.stats.stats.uptime)) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  });

  // Subscribe to storage quota updates if NostrService is available
  createEffect(() => {
    if (props.nostrService) {
      const subscription = props.nostrService.dbQuota$.subscribe(quota => {
        setStorageInfo(quota);
      });

      return () => subscription.unsubscribe();
    }
  });

  const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getConnectionStatus = () => {
    const activeRelays = stores.relays.activeRelays.length;
    const totalRelays = stores.relays.enabledRelays.length;

    if (activeRelays === 0) return { status: 'disconnected', color: 'text-red-500' };
    if (activeRelays < totalRelays) return { status: 'partial', color: 'text-yellow-500' };
    return { status: 'connected', color: 'text-green-500' };
  };

  return (
    <footer class="stats-bar sticky bottom-0 z-20" title="Real-time application statistics and connection status">
      {/* Left side - Connection & Performance */}
      <div class="flex items-center space-x-4" title="Connection status and performance metrics">
        {/* Connection Status */}
        <div class="flex items-center space-x-2" title="Nostr relay connection status">
          <div class={`w-2 h-2 rounded-full ${getConnectionStatus().color}`} title="Connection status indicator">
            <div class={`w-full h-full rounded-full animate-pulse ${
              getConnectionStatus().status === 'connected' ? 'bg-green-500' :
              getConnectionStatus().status === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
          </div>
          <span class={getConnectionStatus().color} title="Number of active relay connections out of total enabled relays">
            {stores.relays.activeRelays.length}/{stores.relays.enabledRelays.length} relays
          </span>
        </div>

        {/* Events Received */}
        <div class="flex items-center space-x-1" title="Total number of Nostr events received from all relays">
          <svg class="w-3 h-3 text-wireframe-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span>{formatNumber(stores.stats.stats.eventsReceived)} events</span>
        </div>

        {/* Unique Hashtags */}
        <div class="flex items-center space-x-1" title="Number of unique hashtags discovered in events">
          <svg class="w-3 h-3 text-wireframe-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
            />
          </svg>
          <span>{formatNumber(stores.hashtags.hashtags.length)} tags</span>
        </div>
      </div>

      {/* Right side - Uptime & Last Update */}
      <div class="flex items-center space-x-4" title="System uptime and activity information">
        {/* Last Update */}
        {stores.stats.stats.lastUpdate > 0 && (
          <div class="flex items-center space-x-1" title="Fetching events seen in the last 30min">
            <svg class="w-3 h-3 text-wireframe-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              30m
            </span>
          </div>
        )}

        {/* Last Update */}
        {stores.stats.stats.lastUpdate > 0 && (
          <div class="flex items-center space-x-1" title="When the last event was received from any relay">
            <svg class="w-3 h-3 text-wireframe-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              {formatRelativeTime(stores.stats.stats.lastUpdate / 1000)}
            </span>
          </div>
        )}

        {/* Uptime */}
        <div class="flex items-center space-x-1" title="How long the application has been running">
          <svg class="w-3 h-3 text-wireframe-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z"
            />
          </svg>
          <span>{formatUptime(uptime())}</span>
        </div>

      </div>
    </footer>
  );
};

export default BottomBar;
