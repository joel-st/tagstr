import { Component, For, createSignal, Show } from 'solid-js';
import { stores } from '../stores';
import { NostrService } from '../services/NostrService';
import { formatRelativeTime, formatNumber, isValidRelayUrl } from '../utils/helpers';
import { standardRelayDiscovery } from '../utils/relayDiscovery';


interface RelayPanelProps {
  nostrService: NostrService;
}

const RelayPanel: Component<RelayPanelProps> = (props) => {
  const [newRelayUrl, setNewRelayUrl] = createSignal('');
  const [isAddingRelay, setIsAddingRelay] = createSignal(false);

  const handleClose = () => {
    stores.ui.closePanel();
  };

  const handleAddRelay = () => {
    const url = newRelayUrl().trim();

    if (!url) return;

    if (!isValidRelayUrl(url)) {
      alert('Please enter a valid WebSocket URL (ws:// or wss://)');
      return;
    }

    const existingRelay = stores.relays.relays.find(r => r.url === url);
    if (existingRelay) {
      alert('This relay is already added');
      return;
    }

    setIsAddingRelay(true);
    props.nostrService.connectToRelay(url);
    setNewRelayUrl('');

    setTimeout(() => {
      setIsAddingRelay(false);
    }, 2000);
  };

  const handleRemoveRelay = (url: string) => {
    if (confirm(`Remove relay ${url}?`)) {
      props.nostrService.removeRelay(url);
    }
  };

  const handleToggleRelay = (url: string) => {
    // Toggling is not supported in the new service
  };



  return (
    <div class="h-full flex flex-col">
      {/* Header */}
      <div class="p-4 border-b border-wireframe-300 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Relay Monitor</h2>
          <p class="text-sm text-wireframe-500">
            {stores.relays.activeRelays.length} of {stores.relays.relays.length} relays connected
          </p>
        </div>
        <button
          onClick={handleClose}
          class="wireframe-button p-2 hover:bg-wireframe-100"
          title="Close relay monitor"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Add Relay Form */}
      <div class="p-4 border-b border-wireframe-200 bg-wireframe-50">
        <div class="space-y-3">
          <label class="block text-sm font-medium text-wireframe-700">
            Add New Relay
          </label>
          <div class="flex space-x-2">
            <input
              type="text"
              placeholder="wss://relay.example.com"
              value={newRelayUrl()}
              onInput={(e) => setNewRelayUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddRelay()}
              class="wireframe-input flex-1 text-sm"
              disabled={isAddingRelay()}
            />
            <button
              onClick={handleAddRelay}
              disabled={isAddingRelay() || !newRelayUrl().trim()}
              class="wireframe-button px-4 py-2 hover:bg-wireframe-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAddingRelay() ? (
                <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              ) : (
                'Add'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Relay List */}
      <div class="flex-1 overflow-auto">
        <div class="divide-y divide-wireframe-200">
          <For each={stores.relays.relays}>{
            (relay) => (
              <div class="p-2 hover:bg-wireframe-50">
                <div class="flex items-center justify-between space-x-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2">
                      <div
                        class={`w-3 h-3 rounded-full flex-shrink-0 ${relay.metrics.connected ? 'bg-green-500' : 'bg-red-500'}`}>
                      </div>
                      <span class="font-medium text-sm truncate">
                        {relay.url.replace(/^wss?:\/\//, '')}
                      </span>
                      <span
                        class="text-xs bg-wireframe-200 text-wireframe-600 px-2 py-0.5 rounded-full">
                        Events: {formatNumber(relay.metrics.eventsReceived)}
                      </span>
                    </div>
                    <Show when={!relay.metrics.connected && relay.metrics.error}>
                      <p class="text-xs text-red-500 mt-1 ml-5">
                        {relay.metrics.error}
                      </p>
                    </Show>
                  </div>
                  <div class="flex items-center space-x-2">
                    <button
                      onClick={() => handleRemoveRelay(relay.url)}
                      class="wireframe-button p-1 hover:bg-red-50 hover:border-red-300 text-red-600"
                      title="Remove relay">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>

        <Show when={stores.relays.relays.length === 0}>
          <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div
              class="w-12 h-12 border border-wireframe-300 rounded-full flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-wireframe-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h3 class="text-lg font-medium text-wireframe-700 mb-2">
              No relays configured
            </h3>
            <p class="text-wireframe-500 max-w-sm">
              Add relay URLs above to start receiving events from the nostr network.
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default RelayPanel;
