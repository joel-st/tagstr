import { Component, createSignal, onCleanup, onMount } from 'solid-js';
import { formatRelativeTime } from '../utils/helpers';

interface RelativeTimeProps {
  timestamp: number;
}

const RelativeTime: Component<RelativeTimeProps> = (props) => {
  const [timeAgo, setTimeAgo] = createSignal(formatRelativeTime(props.timestamp));

  let interval: number;

  onMount(() => {
    interval = setInterval(() => {
      setTimeAgo(formatRelativeTime(props.timestamp));
    }, 10000); // update every 10 seconds
  });

  onCleanup(() => {
    clearInterval(interval);
  });

  return <>{timeAgo()}</>;
};

export default RelativeTime;