import { Component, For, Show } from 'solid-js';
import { stores, getFilteredHashtags } from '../stores';
import { getHashtagColor } from '../utils/helpers';
import { navigate } from '../utils/navigation';
import RelativeTime from './RelativeTime';

const HashtagList: Component = () => {
  const handleHashtagClick = (hashtag: string) => {
    stores.hashtags.setSelectedHashtag(hashtag);
    navigate(`/hashtag/${encodeURIComponent(hashtag)}`);
  };

  return (
    <div class="flex-1 overflow-auto">
      {/* Empty State */}
      <Show when={!getFilteredHashtags()?.length}>
        <div class="flex flex-col items-center justify-center py-16 px-4 text-center" title="No hashtags to display">
          <div class="w-16 h-16 border border-wireframe-300 rounded-full flex items-center justify-center mb-4" title="Hashtag icon">
            <svg class="w-8 h-8 text-wireframe-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
              />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-wireframe-700 mb-2" title="Current state message">
            {stores.ui.searchQuery() ? 'No hashtags found' : 'No hashtags yet'}
          </h3>
          <p class="text-wireframe-500 max-w-sm">
            {stores.ui.searchQuery()
              ? `No hashtags match "${stores.ui.searchQuery()}". Try a different search term.`
              : 'Connect to relays and start discovering hashtags from the nostr network.'
            }
          </p>
          {!stores.ui.searchQuery() && (
            <button
              onClick={() => stores.ui.setActivePanel('relay')}
              class="wireframe-button mt-4 px-4 py-2 hover:bg-wireframe-100"
              title="Open relay configuration to connect to Nostr relays and start discovering hashtags"
            >
              Configure Relays
            </button>
          )}
        </div>
      </Show>

      {/* Hashtag List */}
      <div class="divide-y divide-wireframe-200" title="List of discovered hashtags">
        <For each={getFilteredHashtags() || []}>
          {(hashtag, index) => (
            <div
              class="hashtag-item group"
              onClick={() => handleHashtagClick(hashtag.hashtag)}
              title={`Click to view detailed insights for #${hashtag.hashtag} - used ${hashtag.count} times`}
            >
              <div class="flex items-center space-x-3">
                {/* Hashtag Color Indicator */}
                <div
                  class="w-3 h-3 rounded-full border border-wireframe-300"
                  style={`background-color: ${getHashtagColor(hashtag.hashtag)}`}
                  title={`Color identifier for #${hashtag.hashtag}`}
                />

                {/* Hashtag Name */}
                <div class="flex-1 min-w-0">
                  <div class="flex items-center space-x-2">
                    <span class="font-medium text-wireframe-800" title={`Hashtag: ${hashtag.hashtag}`}>
                      #{hashtag.hashtag}
                    </span>
                    <Show when={hashtag.trending}>
                      <div class="flex items-center space-x-1 text-xs text-red-500" title="This hashtag is currently trending with high activity">
                        <div class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" title="Trending indicator"></div>
                        <span>trending</span>
                      </div>
                    </Show>
                  </div>
                  <div class="text-xs text-wireframe-500" title="When this hashtag was last seen in an event">
                    Last seen <RelativeTime timestamp={hashtag.lastSeen / 1000} />
                  </div>
                </div>
              </div>

              {/* Count and Actions */}
              <div class="flex items-center space-x-2">
                <div class="text-right" title={`This hashtag has been used ${hashtag.count} times`}>
                  <div class="font-semibold text-wireframe-800">
                    {hashtag.count.toLocaleString()}
                  </div>
                  <div class="text-xs text-wireframe-500">
                    uses
                  </div>
                </div>

                {/* Arrow Icon */}
                <div class="text-wireframe-400 group-hover:text-wireframe-600 transition-colors" title="Click to view hashtag details">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default HashtagList;
