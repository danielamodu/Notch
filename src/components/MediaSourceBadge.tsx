import React from 'react';
import { Music, Radio, Volume2 } from 'lucide-react';
import { MediaTrack } from '../types/island.ts';

export type MediaSourceId =
  | 'spotify'
  | 'youtube'
  | 'ytmusic'
  | 'applemusic'
  | 'soundcloud'
  | 'tidal'
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'brave'
  | 'discord'
  | 'vlc'
  | 'generic';

export interface MediaSourceMeta {
  id: MediaSourceId;
  name: string;
  brandColor: string;
  accentBg: string;
}

export function detectMediaSource(media?: Partial<MediaTrack> | null): MediaSourceMeta {
  if (!media) {
    return {
      id: 'generic',
      name: 'Media',
      brandColor: '#A3A3A3',
      accentBg: 'rgba(255,255,255,0.08)',
    };
  }

  const appId = (media.appId || '').toLowerCase();
  const title = (media.title || '').toLowerCase();
  const artist = (media.artist || '').toLowerCase();
  const full = `${appId} ${title} ${artist}`;

  // 1. Spotify
  if (full.includes('spotify')) {
    return {
      id: 'spotify',
      name: 'Spotify',
      brandColor: '#1DB954',
      accentBg: 'rgba(29, 185, 84, 0.15)',
    };
  }

  // 2. YouTube Music
  if (full.includes('music.youtube') || full.includes('ytmusic') || full.includes('youtube music')) {
    return {
      id: 'ytmusic',
      name: 'YouTube Music',
      brandColor: '#FF0000',
      accentBg: 'rgba(255, 0, 0, 0.15)',
    };
  }

  // 3. YouTube (Browser / Web)
  if (full.includes('youtube') || full.includes('youtu.be')) {
    return {
      id: 'youtube',
      name: 'YouTube',
      brandColor: '#FF0000',
      accentBg: 'rgba(255, 0, 0, 0.15)',
    };
  }

  // 4. Apple Music / iTunes
  if (
    full.includes('apple.music') ||
    full.includes('applemusic') ||
    full.includes('itunes') ||
    full.includes('music.ui')
  ) {
    return {
      id: 'applemusic',
      name: 'Apple Music',
      brandColor: '#FA243C',
      accentBg: 'rgba(250, 36, 60, 0.15)',
    };
  }

  // 5. SoundCloud
  if (full.includes('soundcloud')) {
    return {
      id: 'soundcloud',
      name: 'SoundCloud',
      brandColor: '#FF5500',
      accentBg: 'rgba(255, 85, 0, 0.15)',
    };
  }

  // 6. Tidal
  if (full.includes('tidal')) {
    return {
      id: 'tidal',
      name: 'TIDAL',
      brandColor: '#00FFFF',
      accentBg: 'rgba(0, 255, 255, 0.15)',
    };
  }

  // 7. Discord
  if (full.includes('discord')) {
    return {
      id: 'discord',
      name: 'Discord',
      brandColor: '#5865F2',
      accentBg: 'rgba(88, 101, 242, 0.15)',
    };
  }

  // 8. VLC Media Player
  if (full.includes('vlc') || full.includes('videolan')) {
    return {
      id: 'vlc',
      name: 'VLC',
      brandColor: '#FF8800',
      accentBg: 'rgba(255, 136, 0, 0.15)',
    };
  }

  // 9. Microsoft Edge
  if (full.includes('msedge') || full.includes('microsoftedge') || full.includes('edge')) {
    return {
      id: 'edge',
      name: 'Microsoft Edge',
      brandColor: '#0078D7',
      accentBg: 'rgba(0, 120, 215, 0.15)',
    };
  }

  // 10. Brave Browser
  if (full.includes('brave')) {
    return {
      id: 'brave',
      name: 'Brave',
      brandColor: '#FB542B',
      accentBg: 'rgba(251, 84, 43, 0.15)',
    };
  }

  // 11. Mozilla Firefox
  if (full.includes('firefox') || full.includes('mozilla')) {
    return {
      id: 'firefox',
      name: 'Firefox',
      brandColor: '#FF7139',
      accentBg: 'rgba(255, 113, 57, 0.15)',
    };
  }

  // 12. Google Chrome
  if (full.includes('chrome')) {
    return {
      id: 'chrome',
      name: 'Chrome',
      brandColor: '#4285F4',
      accentBg: 'rgba(66, 133, 244, 0.15)',
    };
  }

  return {
    id: 'generic',
    name: 'Media',
    brandColor: '#A3A3A3',
    accentBg: 'rgba(255,255,255,0.08)',
  };
}

interface MediaSourceIconProps {
  media?: Partial<MediaTrack> | null;
  className?: string;
}

export const MediaSourceIcon: React.FC<MediaSourceIconProps> = ({ media, className = 'size-3.5' }) => {
  const meta = detectMediaSource(media);

  switch (meta.id) {
    case 'spotify':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#1DB954">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.508 17.308c-.22.355-.683.47-1.038.25-2.846-1.74-6.428-2.133-10.648-1.17-.406.093-.812-.163-.905-.57-.093-.407.163-.813.57-.906 4.628-1.057 8.583-.61 11.77 1.34.356.22.47.683.251 1.038zm1.47-3.26c-.276.444-.86.586-1.304.31-3.258-2.002-8.225-2.583-12.078-1.413-.497.15-1.025-.133-1.176-.63-.15-.497.133-1.025.63-1.176 4.404-1.336 9.876-.69 13.618 1.605.444.276.586.86.31 1.304zm.128-3.395C15.22 8.358 8.788 8.14 5.116 9.255c-.604.183-1.246-.16-1.43-.764-.183-.604.16-1.246.764-1.43 4.23-1.284 11.337-1.035 15.803 1.616.544.323.722 1.03.4 1.574-.323.543-1.03.722-1.574.4z" />
        </svg>
      );

    case 'youtube':
    case 'ytmusic':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#FF0000">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );

    case 'applemusic':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#FA243C">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.65 6.35l-4.5 1.13c-.37.09-.65.43-.65.81v5.21c-.42-.2-.91-.32-1.44-.32-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V11.8l4-1v2.71c-.42-.2-.91-.32-1.44-.32-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8.81c0-.46-.35-.83-.81-.88z" />
        </svg>
      );

    case 'soundcloud':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#FF5500">
          <path d="M11.56 8.87v9.42h8.03c2.43 0 4.41-1.98 4.41-4.41 0-2.34-1.83-4.25-4.14-4.4-.38-3.08-3.02-5.48-6.2-5.48-1.57 0-3.03.58-4.15 1.54-.38.33-.7.71-.95 1.13v2.2zM9.7 10.37v7.92h1.01V9.95c-.37.11-.71.25-1.01.42zM7.85 11.64v6.65h1.01v-7.1c-.37.12-.71.27-1.01.45zM6 13.06v5.23h1.01v-5.69c-.36.13-.7.3-1.01.46zM4.15 14.36v3.93h1.01v-4.38c-.36.14-.7.29-1.01.45zM2.31 15.34v2.95h1.01v-3.39c-.36.13-.7.27-1.01.44zM0 16.27v1.07c0 .52.43.95.95.95h.51v-2.39c-.35.08-.68.2-1.46.37z" />
        </svg>
      );

    case 'tidal':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#00FFFF">
          <path d="M12.012 3.992L8.008 8l4.004 4.008 4.004-4.008-4.004-4.008zm-8.016 8L0 16.008l4.004 4.008 4.004-4.008L3.996 12zm8.016 0L8.008 16l4.004 4.008 4.004-4.008-4.004-4zm8.016 0L16.024 16l4.004 4.008 4.004-4.008-4.004-4z" />
        </svg>
      );

    case 'discord':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#5865F2">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      );

    case 'chrome':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="#4285F4" />
          <circle cx="12" cy="12" r="4.5" fill="#FFFFFF" />
          <circle cx="12" cy="12" r="3.5" fill="#1A73E8" />
        </svg>
      );

    case 'edge':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#0078D7">
          <path d="M21.986 16.516c-.227 3.32-2.88 5.484-6.315 5.484-6.096 0-9.671-4.704-9.671-10.435C6 5.565 10.378 1 16.326 1c4.27 0 6.674 2.464 6.674 5.762 0 2.827-1.749 4.887-4.226 4.887-1.488 0-2.585-.806-2.585-2.029 0-.258.05-.515.15-.758.33-.82.68-1.547.68-2.227 0-1.229-.878-2.062-2.128-2.062-1.782 0-3.155 1.83-3.155 4.542 0 4.14 2.83 7.02 6.777 7.02 1.49 0 2.66-.37 3.473-.974z" />
        </svg>
      );

    case 'brave':
    case 'firefox':
    case 'vlc':
      return <Radio className={`${className} text-orange-400`} />;

    default:
      return <Music className={`${className} text-white`} />;
  }
};

export const MediaSourceBadge: React.FC<{ media?: Partial<MediaTrack> | null; className?: string }> = ({
  media,
  className = '',
}) => {
  const meta = detectMediaSource(media);

  return (
    <div
      style={{ backgroundColor: meta.accentBg, borderColor: `${meta.brandColor}40` }}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border ${className}`}
    >
      <MediaSourceIcon media={media} className="size-2.5" />
      <span
        style={{ color: meta.brandColor }}
        className="text-[9px] font-bold font-mono tracking-tight leading-none"
      >
        {meta.name}
      </span>
    </div>
  );
};
