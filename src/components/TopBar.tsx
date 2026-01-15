import { Component, createSignal } from 'solid-js';
import { stores } from '../stores';

const TopBar: Component = () => {
  const [searchFocused, setSearchFocused] = createSignal(false);

  const handleSearchInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    stores.ui.setSearchQuery(target.value);
  };

  const handleSearchFocus = () => {
    setSearchFocused(true);
  };

  const handleSearchBlur = () => {
    setSearchFocused(false);
  };

  const toggleRelayPanel = () => {
    stores.ui.togglePanel('relay');
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all local data? This action cannot be undone.')) {
      stores.settings.resetSettings();
      stores.relays.reset();
      stores.hashtags.reset();
      stores.profiles.reset();
      stores.stats.reset();
      alert('All local data has been cleared. The application will now reload.');
      window.location.reload();
    }
  };

  return (
    <header class="wireframe-border bg-wireframe-50 border-b sticky top-0 z-30">
      <div class="px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <a href="/#/" class="flex items-center space-x-2" title="Tagstr - Nostr hashtag explorer">
          <h1 class="text-xl font-bold tracking-tight" title="Application name">
            tagstr
          </h1>
          <div class="text-xs text-wireframe-500 hidden sm:block" title="Current version">
            v0.1.0
          </div>
        </a>

        {/* Search Bar */}
        <div class="flex-1 max-w-md mx-4">
          <div class={`relative transition-all duration-200 ${
            searchFocused() ? 'scale-105' : ''
          }`}>
            <input
              id="search-input"
              type="text"
              placeholder="Search hashtags..."
              value={stores.ui.searchQuery()}
              onInput={handleSearchInput}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              class="wireframe-input w-full pl-8 pr-4 text-sm placeholder-wireframe-500"
              title="Search through discovered hashtags by name"
            />
            <div class="absolute left-2 top-1/2 transform -translate-y-1/2 text-wireframe-400" title="Search icon">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            {stores.ui.searchQuery() && (
              <button
                onClick={() => stores.ui.setSearchQuery('')}
                class="absolute right-2 top-1/2 transform -translate-y-1/2 text-wireframe-400 hover:text-wireframe-600"
                title="Clear search query"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          {/* Search hint */}
          <div class="text-xs text-wireframe-400 mt-1 text-center">
            {searchFocused() && 'Press Esc to close • Ctrl+/ to focus'}
          </div>
        </div>

        {/* Service Menu Icons */}
        <div class="flex items-center space-x-2">
          {/* Relay Monitor */}
          <button
            onClick={toggleRelayPanel}
            class={`wireframe-button p-2 relative ${
              stores.ui.activePanel() === 'relay'
                ? 'bg-wireframe-200 border-wireframe-600'
                : 'hover:bg-wireframe-100'
            }`}
            title="Open relay monitor - view and manage Nostr relay connections"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
            {/* Active relays indicator */}
            <div class="absolute -top-1 -right-1 bg-wireframe-600 text-wireframe-50 text-xs rounded-full w-5 h-5 flex items-center justify-center" title="Number of active relay connections">
              {stores.relays.activeRelays.length}
            </div>
          </button>

          {/* Loading indicator */}
          {stores.ui.isLoading() && (
            <div class="animate-pulse-slow" title="Loading data from relays">
              <svg class="w-5 h-5 text-wireframe-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Sort controls bar */}
      <div class="px-4 py-2 border-t border-wireframe-200 bg-wireframe-50 flex items-center justify-between text-sm" title="Hashtag sorting and statistics">
        <div class="flex items-center space-x-4">
          <h2 class="text-lg font-semibold" title="Main content area showing all discovered hashtags">
            Hashtag Feed
          </h2>
        </div>

        <div class="text-wireframe-500 text-xs" title="Total hashtags discovered and their combined usage count">
          {stores.hashtags.totalHashtags} hashtags • {stores.hashtags.totalCounts} total uses
        </div>
      </div>
    </header>
  );
};

export default TopBar;
