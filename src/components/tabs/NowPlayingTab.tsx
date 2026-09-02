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
    <div className="flex flex-col justify-between h-full px-3.5 pt-1.5 pb-3 text-white select-none overflow-hidden">
      {/* 1. Track Info & Artwork */}
      <div className="flex items-center gap-2.5">
        <div className="relative size-10 shrink-0 rounded-lg overflow-hidden bg-neutral-900 flex items-center justify-center border border-white/10 shadow-sm">
          {media.thumbnail ? (
            <img src={media.thumbnail} alt="" className="size-full object-cover" />
          ) : (
            <div
              style={{ backgroundColor: source.accentBg || '#1db954' }}
              className="size-full flex items-center justify-center text-white"
            >
              <MediaSourceIcon media={media} className="size-5" />
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0 flex-1 justify-center">
          <span className="truncate text-xs font-semibold text-white leading-tight">
            {media.title || 'No Media Playing'}
          </span>
          <div className="flex items-center gap-1.5 truncate text-[11px] text-neutral-400 leading-tight mt-0.5">
            <MediaSourceBadge media={media} />
            <span className="truncate">{media.artist || 'Windows Media'}</span>
          </div>
        </div>

        <button
          onClick={() => setLiked(!liked)}
          className={`size-7 rounded-full flex items-center justify-center transition active:scale-95 ${
            liked ? 'text-rose-400 bg-rose-500/10' : 'text-neutral-500 hover:text-white bg-white/5'
          }`}
        >
          <Heart className={`size-3.5 ${liked ? 'fill-rose-400' : ''}`} />
        </button>
      </div>

      {/* 2. Progress Scrubber */}
      <div className="flex flex-col gap-0.5 my-1">
        <div className="relative w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[9px] font-mono text-neutral-400">
          <span>{formatTime(currentPos)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      {/* 3. Playback Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => onControl('previous')}
          className="size-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-neutral-300 hover:text-white active:scale-90 transition"
          title="Previous"
        >
          <SkipBack className="size-3.5" />
        </button>

        <button
          onClick={() => onControl('toggle')}
          className="size-8 rounded-full bg-white text-black hover:scale-105 flex items-center justify-center shadow-md active:scale-95 transition"
          title={media.isPlaying ? 'Pause' : 'Play'}
        >
          {media.isPlaying ? (
            <Pause className="size-4 fill-black" />
          ) : (
            <Play className="size-4 fill-black translate-x-0.5" />
          )}
        </button>

        <button
          onClick={() => onControl('next')}
          className="size-7 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-neutral-300 hover:text-white active:scale-90 transition"
          title="Next"
        >
          <SkipForward className="size-3.5" />
        </button>
      </div>
    </div>
  );
};
