import { Component, onMount, onCleanup, Show } from 'solid-js';
import './index.css';
import { initNavigation, getCurrentRoute, getRouteParams } from './utils/navigation';

// Components
import TopBar from './components/TopBar';
import HashtagList from './components/HashtagList';
import BottomBar from './components/BottomBar';

import RelayPanel from './components/RelayPanel';

import HashtagHub from './components/HashtagHub';

// Stores
import { stores } from './stores';
import { NostrService } from './services/NostrService';

const App: Component = () => {
  let cleanupFunctions: (() => void)[] = [];

  const nostrService = new NostrService();

  onMount(() => {
    const startTime = Date.now();
    const uptimeInterval = setInterval(() => {
      stores.stats.setStat('uptime', Date.now() - startTime);
    }, 1000);
    cleanupFunctions.push(() => clearInterval(uptimeInterval));

    const relayStatusSub = nostrService.relayStatuses$.subscribe(statuses => {
      const relayArray = Array.from(statuses.values()).map(status => ({
        url: status.url,
        enabled: true, // Assuming all relays are enabled by default
        read: true,
        write: true,
        metrics: {
          url: status.url,
          connected: status.connected,
          connectionTime: 0,
          eventsReceived: status.eventsReceived,
          lastEventTime: status.lastActivity?.getTime() || 0,
          latency: 0, // Not available in this service
          errors: 0,
          subscriptions: 0,
          error: status.error,
        }
      }));
      stores.relays.setRelays(relayArray);
      stores.stats.setStat('activeRelays', relayArray.filter(r => r.metrics.connected).length);
    });

    const eventsSub = nostrService.events$.subscribe(event => {
      if (!event) return; // Skip null events
      
      stores.stats.setStat('lastUpdate', Date.now());
      if (event.kind === 0) {
        try {
          const profile = JSON.parse(event.content);
          profile.pubkey = event.pubkey;
          stores.profiles.setProfile(profile);
        } catch (e) {
          console.error("Error parsing profile content", e);
        }
      }

      const hashtags = event.tags.filter(t => t[0] === 't').map(t => t[1]);
      hashtags.forEach(hashtag => {
        stores.hashtags.updateHashtagCount(hashtag, event.created_at);
      });
      
      // Update unique hashtags count
      stores.stats.setStat('uniqueHashtags', stores.hashtags.hashtags.length);
    });

    const totalEventsSub = nostrService.totalEvents$.subscribe(total => {
      stores.stats.setStat('eventsReceived', total);
    });

    cleanupFunctions.push(() => {
      relayStatusSub.unsubscribe();
      eventsSub.unsubscribe();
      totalEventsSub.unsubscribe();
      nostrService.disconnect();
    });

    // Handle keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stores.ui.closePanel();
        stores.hashtags.setSelectedHashtag(null);
      }
      
      if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    cleanupFunctions.push(() => document.removeEventListener('keydown', handleKeyDown));

    // Initialize navigation
    const cleanupNav = initNavigation();
    cleanupFunctions.push(cleanupNav);
  });

  onCleanup(() => {
    cleanupFunctions.forEach(cleanup => cleanup());
  });

  // Handle panel overlay clicks
  const handleOverlayClick = () => {
    stores.ui.closePanel();
  };

  // Simple routing logic
  const getCurrentComponent = () => {
    const route = getCurrentRoute();
    if (route === 'hashtag') {
      return () => <HashtagHub nostrService={nostrService} />;
    }
    return () => <HashtagList />;
  };

  return (
    <div class="min-h-screen flex flex-col bg-wireframe-50 text-wireframe-900 font-mono">
      <TopBar />
      
      <main class="flex-1 overflow-auto">
        {getCurrentComponent()()}
      </main>
      
      <BottomBar nostrService={nostrService} />
        
        <Show when={stores.ui.activePanel()}>
          <div 
            class="panel-overlay" 
            onClick={handleOverlayClick}
          />
        </Show>
        

        
        <Show when={stores.ui.activePanel() === 'relay'}>
          <div class="panel-content">
            <RelayPanel nostrService={nostrService} />
          </div>
        </Show>
        

    </div>
  );
};

export default App;