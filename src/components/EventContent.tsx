import { Component, For } from 'solid-js';

interface EventContentProps {
  content: string;
}

const urlRegex = /(https?:\/\/\S+)/g;
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const videoExtensions = ['.mp4', '.webm', '.mov'];

const EventContent: Component<EventContentProps> = (props) => {
  const parts = () => {
    const content = props.content;
    const result: (string | { type: 'image' | 'video' | 'link'; url: string })[] = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(content)) !== null) {
      // Add text before the URL
      if (match.index > lastIndex) {
        result.push(content.substring(lastIndex, match.index));
      }

      const url = match[0];
      const isImage = imageExtensions.some(ext => url.toLowerCase().endsWith(ext));
      const isVideo = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));

      if (isImage) {
        result.push({ type: 'image', url });
      } else if (isVideo) {
        result.push({ type: 'video', url });
      } else {
        result.push({ type: 'link', url });
      }

      lastIndex = match.index + url.length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      result.push(content.substring(lastIndex));
    }

    return result;
  };

  return (
    <div>
      <For each={parts()}>
        {(part) => {
          if (typeof part === 'string') {
            // Replace newlines with <br>
            const lines = part.split('\n');
            return (
              <For each={lines}>
                {(line, index) => (
                  <>
                    {line}
                    {index() < lines.length - 1 && <br />}
                  </>
                )}
              </For>
            );
          }
          if (part.type === 'image') {
            return <img src={part.url} class="max-w-full rounded-lg my-2" />;
          }
          if (part.type === 'video') {
            return <video src={part.url} controls class="max-w-full rounded-lg my-2" />;
          }
          if (part.type === 'link') {
            return <a href={part.url} target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">{part.url}</a>;
          }
        }}
      </For>
    </div>
  );
};

export default EventContent;
