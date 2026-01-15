import { Component, createMemo, Show, For, createSignal, onMount, onCleanup } from 'solid-js';

import { stores } from '../stores';
import { navigate, getRouteParams } from '../utils/navigation';
import { formatRelativeTime, formatNumber, hexToNpub, getHashtagColor, hexToShortNpub } from '../utils/helpers';
import { HashtagInsights, NostrEvent } from '../types';
import { NostrService } from '../services/NostrService';
import EventContent from './EventContent';

interface HashtagHubProps {
  nostrService: NostrService;
}

const HashtagHub: Component<HashtagHubProps> = (props) => {
  const hashtag = createMemo(() => {
    const params = getRouteParams();
    return params.tag || '';
  });

  const [hashtagEvents, setHashtagEvents] = createSignal<NostrEvent[]>([]);
  const [insights, setInsights] = createSignal<HashtagInsights | null>(null);
  const [loading, setLoading] = createSignal(true);

  let eventSubscription: any = null;

  const updateHashtagData = (tag: string) => {
    const filteredEvents = props.nostrService.getHashtagEvents(tag);
    setHashtagEvents(filteredEvents);

    // If no events from NostrService, check if hashtag exists in store but no events tracked yet
    const hashtagInStore = stores.hashtags.hashtags.find(h => h.hashtag.toLowerCase() === tag.toLowerCase());

    // Calculate insights
    const authorCountMap = new Map<string, number>();
    const relatedTagsMap = new Map<string, number>();

    filteredEvents.forEach(event => {
      authorCountMap.set(event.pubkey, (authorCountMap.get(event.pubkey) || 0) + 1);
      event.tags.forEach(t => {
        if (t[0] === 't' && t[1] !== tag) {
          relatedTagsMap.set(t[1], (relatedTagsMap.get(t[1]) || 0) + 1);
        }
      });
    });

    // Get relay distribution data
    const relayDistribution = props.nostrService.getHashtagRelayDistribution(tag);

    const insightsData: HashtagInsights = {
      hashtag: tag,
      totalEvents: filteredEvents.length || (hashtagInStore ? hashtagInStore.count : 0),
      uniqueAuthors: authorCountMap.size,
      relatedTags: Array.from(relatedTagsMap.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count).slice(0, 20),
      topAuthors: Array.from(authorCountMap.entries()).map(([pubkey, count]) => ({ pubkey, count, profile: stores.profiles.getProfile(pubkey) })).sort((a, b) => b.count - a.count).slice(0, 10),
      relayDistribution: relayDistribution.sort((a, b) => b.count - a.count),
      timeDistribution: [] // Time distribution would require more complex tracking
    };

        setInsights(insightsData);
  };

  onMount(async () => {
    const tag = hashtag();
    if (tag) {
      setLoading(true);
      try {
        console.log('Loading hashtag data for:', tag);
        updateHashtagData(tag);

        // Check if hashtag exists in store but has no detailed events
        const hashtagInStore = stores.hashtags.hashtags.find(h => h.hashtag.toLowerCase() === tag.toLowerCase());
        console.log('Hashtag in store:', hashtagInStore);
        console.log('Events found:', hashtagEvents().length);

        // Subscribe to new events and update in real-time
        eventSubscription = props.nostrService.events$.subscribe(event => {
          if (event && event.tags.some(t => t[0] === 't' && t[1]?.toLowerCase() === tag.toLowerCase())) {
            console.log('New event for hashtag:', tag, event);
            updateHashtagData(tag);
          }
        });

      } catch (error) {
        console.error('Error loading hashtag data:', error);
      } finally {
        setLoading(false);
      }
    }
  });

  onCleanup(() => {
    if (eventSubscription) {
      eventSubscription.unsubscribe();
    }
  });

  const handleBackClick = () => {
    navigate('/');
    stores.hashtags.setSelectedHashtag(null);
  };

  const handleRelatedTagClick = (tag: string) => {
    navigate(`/hashtag/${encodeURIComponent(tag)}`);
    stores.hashtags.setSelectedHashtag(tag);
  };

  return (
    <div class="flex-1 overflow-auto">
      {/* Header */}
      <div class="sticky top-0 bg-wireframe-50 border-b border-wireframe-200 px-4 py-4 z-10">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <button
              onClick={handleBackClick}
              class="wireframe-button p-2 hover:bg-wireframe-100"
              title="Back to hashtag list"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <div class="flex items-center space-x-3">
              <div
                class="w-6 h-6 rounded-full border border-wireframe-300"
                style={`background-color: ${getHashtagColor(hashtag())}`}
              />
              <div>
                <h1 class="text-xl font-bold">#{hashtag()}</h1>
                <div class="text-sm text-wireframe-500">
                  {insights() ? `${formatNumber(insights()!.totalEvents)} events from ${formatNumber(insights()!.uniqueAuthors)} authors` : (loading() ? 'Loading insights...' : 'No data available')}
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center space-x-2">
            {(() => {
              const hashtagData = stores.hashtags.hashtags.find(h => h.hashtag === hashtag());
              return hashtagData?.trending && (
                <div class="flex items-center space-x-1 text-red-500 text-sm">
                  <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span>Trending</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* No Data State */}
      <Show when={!loading() && (!insights() || insights()!.totalEvents === 0)}>
        <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div class="w-16 h-16 border border-wireframe-300 rounded-full flex items-center justify-center mb-4">
            <svg class="w-8 h-8 text-wireframe-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-wireframe-700 mb-2">
            {(() => {
              const hashtagInStore = stores.hashtags.hashtags.find(h => h.hashtag.toLowerCase() === hashtag().toLowerCase());
              if (hashtagInStore && hashtagInStore.count > 0) {
                return `Waiting for new #${hashtag()} events`;
              }
              return `No data for #${hashtag()}`;
            })()}
          </h3>
          <p class="text-wireframe-500 max-w-sm">
            {(() => {
              const hashtagInStore = stores.hashtags.hashtags.find(h => h.hashtag.toLowerCase() === hashtag().toLowerCase());
              if (hashtagInStore && hashtagInStore.count > 0) {
                return `This hashtag has been used ${hashtagInStore.count} times, but detailed event data is only available for new events received while the app is running.`;
              }
              return `This hashtag hasn't been seen in recent events. It might be new or not actively used.`;
            })()}
          </p>
          <button
            onClick={handleBackClick}
            class="wireframe-button mt-4 px-4 py-2 hover:bg-wireframe-100"
          >
            Back to Hashtag List
          </button>
        </div>
      </Show>

      {/* Insights Content */}
      <Show when={!loading() && insights() && insights()!.totalEvents > 0}>
        <div class="p-4 grid grid-cols-1 lg:grid-cols-2 lg:gap-6">
          {/* Left Column */}
          <div class="lg:col-span-1 space-y-6">
            {/* Stats Overview */}
            <div class="grid grid-cols-2 md:grid-cols-2 gap-4">
              <div class="wireframe-border p-4 text-center">
                <div class="text-2xl font-bold text-wireframe-800">
                  {formatNumber(insights()!.totalEvents)}
                </div>
                <div class="text-sm text-wireframe-500">Total Events</div>
              </div>
              <div class="wireframe-border p-4 text-center">
                <div class="text-2xl font-bold text-wireframe-800">
                  {formatNumber(insights()!.uniqueAuthors)}
                </div>
                <div class="text-sm text-wireframe-500">Unique Authors</div>
              </div>
              <div class="wireframe-border p-4 text-center">
                <div class="text-2xl font-bold text-wireframe-800">
                  {formatNumber(insights()!.relatedTags.length)}
                </div>
                <div class="text-sm text-wireframe-500">Related Tags</div>
              </div>
              <div class="wireframe-border p-4 text-center">
                <div class="text-2xl font-bold text-wireframe-800">
                  {formatNumber(insights()!.relayDistribution.length)}
                </div>
                <div class="text-sm text-wireframe-500">Source Relays</div>
              </div>
            </div>

            {/* Related Hashtags */}
            <div class="wireframe-border">
              <div class="p-4 border-b border-wireframe-200">
                <h2 class="text-lg font-semibold">Related Hashtags</h2>
                <p class="text-sm text-wireframe-500">Tags commonly used with #{hashtag()}</p>
              </div>
              <div class="p-4">
                <Show when={insights()!.relatedTags.length === 0}>
                  <div class="text-center text-wireframe-500 py-4">
                    No related hashtags found
                  </div>
                </Show>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                  <For each={insights()!.relatedTags.slice(0, 12)}>
                    {(relatedTag) => (
                      <button
                        onClick={() => handleRelatedTagClick(relatedTag.tag)}
                        class="wireframe-button text-left p-3 hover:bg-wireframe-100 flex items-center justify-between"
                      >
                        <div class="flex items-center space-x-2">
                          <div
                            class="w-3 h-3 rounded-full"
                            style={`background-color: ${getHashtagColor(relatedTag.tag)}`}
                          />
                          <span class="font-medium">#{relatedTag.tag}</span>
                        </div>
                        <span class="text-sm text-wireframe-500">
                          {formatNumber(relatedTag.count)}
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* Top Authors */}
            <div class="wireframe-border">
              <div class="p-4 border-b border-wireframe-200">
                <h2 class="text-lg font-semibold">Top Authors</h2>
                <p class="text-sm text-wireframe-500">Most active users for #{hashtag()}</p>
              </div>
              <div class="divide-y divide-wireframe-200">
                <For each={insights()!.topAuthors.slice(0, 10)}>
                  {(author, index) => (
                    <div class="p-4 flex items-center justify-between">
                      <div class="flex flex-1 items-center space-x-3 min-w-0">
                        <Show
                          when={author.profile?.picture}
                          fallback={
                            <div
                              class="w-8 h-8 rounded-full flex-shrink-0"
                              style={`background-color: ${getHashtagColor(author.pubkey)}`}
                            />
                          }
                        >
                          <img src={author.profile.picture} alt="profile picture" class="w-8 h-8 rounded-full flex-shrink-0" />
                        </Show>
                        <div class="min-w-0">
                          <div class="font-medium truncate">
                            <a target="_blank" href={`https://nostr.at/${hexToNpub(author.pubkey)}`}>
                              {author.profile?.display_name || author.profile?.name || hexToNpub(author.pubkey)}
                            </a>
                          </div>
                          <div class="text-sm text-wireframe-500 truncate">
                            {hexToNpub(author.pubkey)}
                          </div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="font-semibold">{formatNumber(author.count)}</div>
                        <div class="text-xs text-wireframe-500">events</div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div class="lg:col-span-1">
            {/* Recent Events */}
            <div class="wireframe-border">
              <div class="p-4 border-b border-wireframe-200">
                <h2 class="text-lg font-semibold">Recent Events</h2>
                <p class="text-sm text-wireframe-500">Latest posts mentioning #{hashtag()}</p>
              </div>
              <div class="divide-y divide-wireframe-200">
                <For each={hashtagEvents().filter(e => e.kind !== 0 && e.kind !== 10002).slice(0, 20)}>
                  {(event) => (
                    <div class="p-4">
                      <div class="flex items-start space-x-3">
                        <Show
                          when={stores.profiles.profiles[event.pubkey]?.picture}
                          fallback={
                            <div
                              class="w-8 h-8 rounded-full flex-shrink-0"
                              style={`background-color: ${getHashtagColor(event.pubkey)}`}
                            />
                          }
                        >
                          <img src={stores.profiles.profiles[event.pubkey].picture} alt="profile picture" class="w-8 h-8 rounded-full flex-shrink-0" />
                        </Show>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center space-x-2 mb-1">
                            <div class="text-sm font-medium truncate">
                              <a target="_blank" href={`https://nostr.at/${event.id}`}>
                                {(() => {
                                  const profile = stores.profiles.profiles[event.pubkey];
                                  return profile?.display_name || profile?.name || hexToNpub(event.pubkey);
                                })()}
                              </a>
                            </div>
                            <span class="text-xs text-wireframe-500">
                              {formatRelativeTime(event.created_at)}
                            </span>
                          </div>
                          <div class="text-sm text-wireframe-700 break-words">
                            <EventContent content={event.content} />
                          </div>
                          <div class="flex flex-wrap gap-1 mt-2">
                            <For each={event.tags.filter((tag: string[]) => tag[0] === 't').slice(0, 5)}>
                              {(tag) => (
                                <span class="inline-block bg-wireframe-100 text-wireframe-600 text-xs px-2 py-1 rounded">
                                  #{tag[1]}
                                </span>
                              )}
                            </For>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
                <Show when={!loading() && hashtagEvents().length === 0}>
                  <div class="p-8 text-center text-wireframe-500">
                    {(() => {
                      const hashtagInStore = stores.hashtags.hashtags.find(h => h.hashtag.toLowerCase() === hashtag().toLowerCase());
                      if (hashtagInStore && hashtagInStore.count > 0) {
                        return `This hashtag has ${hashtagInStore.count} recorded uses, but detailed events are not available yet. New events will appear here as they are received.`;
                      }
                      return `No recent events found for #${hashtag()}`;
                    })()}
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Bottom spacing */}
      <div class="h-4"></div>
    </div>
  );
};

export default HashtagHub;
