import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Heart } from 'lucide-react';
import { MediaTrack } from '../../types/island.ts';
import { MediaSourceIcon, MediaSourceBadge, detectMediaSource } from '../MediaSourceBadge.tsx';

interface NowPlayingTabProps {
  media: MediaTrack;
  onControl: (action: 'play' | 'pause' | 'toggle' | 'next' | 'previous') => void;
}

export const NowPlayingTab: React.FC<NowPlayingTabProps> = ({ media, onControl }) => {
  const [liked, setLiked] = useState(false);

  const totalDuration = media.duration > 0 ? media.duration : 180;
  const currentPos = Math.min(media.position, totalDuration);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = Math.min(100, Math.max(0, (currentPos / totalDuration) * 100));
  const source = detectMediaSource(media);

  return (
    <div className="flex flex-col gap-3 p-3 text-white">
      {/* Top row: Artwork or Brand Icon, Title, Artist, Like */}
      <div className="flex items-center gap-3">
        <div className="relative size-12 shrink-0 rounded-xl overflow-hidden bg-neutral-900 flex items-center justify-center border border-white/10 shadow-md">
          {media.thumbnail ? (
            <img src={media.thumbnail} alt="" className="size-full object-cover" />
          ) : (
            <div
              style={{ backgroundColor: source.accentBg }}
              className="size-full flex items-center justify-center"
            >
              <MediaSourceIcon media={media} className="size-6" />
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="truncate text-sm font-semibold text-white leading-tight">
            {media.title || 'No Media Playing'}
          </span>
          <div className="flex items-center gap-1.5 truncate text-xs text-neutral-400 leading-tight mt-1">
            <MediaSourceBadge media={media} />
            <span className="truncate">{media.artist || 'Windows Media'}</span>
          </div>
        </div>

        <button
          onClick={() => setLiked(!liked)}
          className={`size-8 rounded-full flex items-center justify-center transition active:scale-95 ${
            liked ? 'text-rose-400 bg-rose-500/10' : 'text-neutral-500 hover:text-white bg-white/5'
          }`}
        >
          <Heart className={`size-4 ${liked ? 'fill-rose-400' : ''}`} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-1">
        <div className="relative w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400">
          <span>{formatTime(currentPos)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4 mt-1">
        <button
          onClick={() => onControl('previous')}
          className="size-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-300 hover:text-white active:scale-95 transition"
        >
          <SkipBack className="size-4" />
        </button>

        <button
          onClick={() => onControl('toggle')}
          className="size-11 rounded-full bg-white text-black hover:scale-105 flex items-center justify-center shadow-lg active:scale-95 transition"
        >
          {media.isPlaying ? (
            <Pause className="size-5 fill-black" />
          ) : (
            <Play className="size-5 fill-black translate-x-0.5" />
          )}
        </button>

        <button
          onClick={() => onControl('next')}
          className="size-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-neutral-300 hover:text-white active:scale-95 transition"
        >
          <SkipForward className="size-4" />
        </button>
      </div>
    </div>
  );
};
