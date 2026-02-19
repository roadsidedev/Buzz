/**
 * Episode Player Page
 *
 * Full-featured audio player with transcript display, playback controls,
 * and keyboard shortcuts. Uses HTML5 audio element for playback.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useEpisode } from '../hooks';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';

interface EpisodePlayerPageProps {
  episodeId?: string;
}

/**
 * Episode player interface with transcript and controls
 */
export function EpisodePlayerPage({ episodeId: propsEpisodeId }: EpisodePlayerPageProps) {
  const params = useParams();
  const episodeId = propsEpisodeId || params.id;
  const { episode, isLoading, error, isGenerating, progress } = useEpisode(episodeId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(true);

  /**
   * Handle play/pause
   */
  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  /**
   * Handle playback rate change
   */
  const handlePlaybackRateChange = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setPlaybackRate(rate);
  };

  /**
   * Handle seek
   */
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  /**
   * Update time display
   */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      }
      if (e.code === 'ArrowRight') {
        if (audioRef.current) {
          audioRef.current.currentTime += 5;
        }
      }
      if (e.code === 'ArrowLeft') {
        if (audioRef.current) {
          audioRef.current.currentTime -= 5;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading episode...</p>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Episode not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold uppercase mb-2">{episode.title}</h1>
        <div className="flex items-center gap-4">
          <Badge variant={episode.status === 'ready' ? 'success' : 'warning'}>
            {episode.status}
          </Badge>
          {episode.duration && <span className="text-gray-600">{formatTime(episode.duration)}</span>}
          <span className="text-gray-600">{episode.listenCount} plays</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 border-2 border-red-500 bg-red-50">
          <p className="text-red-700 font-semibold">Error</p>
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      )}

      {isGenerating && (
        <div className="mb-6 p-4 border-2 border-yellow-500 bg-yellow-50">
          <p className="text-yellow-700 font-semibold mb-2">Generating Episode</p>
          <div className="w-full bg-yellow-200 border-2 border-yellow-700 h-4">
            <div
              className="bg-yellow-700 h-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-yellow-600 text-sm mt-2">{progress}% complete</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Player */}
        <div className="col-span-2 space-y-6">
          {episode.audioUrl && (
            <Card variant="bordered" className="p-6">
              <h2 className="text-xl font-bold uppercase mb-6">Player</h2>

              {/* Hidden audio element */}
              <audio ref={audioRef} src={episode.audioUrl} />

              {/* Progress bar */}
              <input
                type="range"
                min="0"
                max={episode.duration || 0}
                value={currentTime}
                onChange={handleSeek}
                disabled={isGenerating}
                className="w-full mb-4"
              />

              {/* Time display */}
              <div className="flex justify-between text-sm font-mono mb-6">
                <span>{formatTime(currentTime)}</span>
                <span>{episode.duration ? formatTime(episode.duration) : '—'}</span>
              </div>

              {/* Controls */}
              <div className="space-y-4">
                {/* Play/Pause & Seek Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={togglePlayback}
                    disabled={isGenerating || !episode.audioUrl}
                    className="flex-1"
                  >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (audioRef.current) audioRef.current.currentTime -= 15;
                    }}
                    disabled={isGenerating || !episode.audioUrl}
                  >
                    -15s
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (audioRef.current) audioRef.current.currentTime += 15;
                    }}
                    disabled={isGenerating || !episode.audioUrl}
                  >
                    +15s
                  </Button>
                </div>

                {/* Playback Rate */}
                <div>
                  <label className="text-sm font-semibold uppercase block mb-2">
                    Playback Speed
                  </label>
                  <div className="flex gap-2">
                    {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                        disabled={isGenerating || !episode.audioUrl}
                        className={`flex-1 py-2 border-2 font-bold text-xs uppercase transition-all ${
                          playbackRate === rate
                            ? 'border-black bg-black text-white'
                            : 'border-black bg-white hover:bg-gray-50'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Transcript */}
          {episode.transcript && (
            <Card variant="bordered" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold uppercase">Transcript</h2>
                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="text-sm font-semibold border-2 border-black px-3 py-1 hover:bg-gray-100"
                >
                  {showTranscript ? 'Hide' : 'Show'}
                </button>
              </div>

              {showTranscript && (
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {episode.transcript}
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Episode Info */}
          <Card variant="default" className="p-4">
            <h3 className="font-bold uppercase text-sm mb-3">Episode Info</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-bold">{episode.status}</p>
              </div>
              <div>
                <span className="text-gray-600">Duration:</span>
                <p className="font-bold">
                  {episode.duration ? formatTime(episode.duration) : 'Generating...'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Plays:</span>
                <p className="font-bold">{episode.listenCount}</p>
              </div>
              <div>
                <span className="text-gray-600">Created:</span>
                <p className="font-bold text-xs">{new Date(episode.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card variant="default" className="p-4">
            <h3 className="font-bold uppercase text-sm mb-3">Shortcuts</h3>
            <div className="space-y-1 text-xs">
              <p>
                <span className="font-mono bg-gray-200 px-1">Space</span> Play/Pause
              </p>
              <p>
                <span className="font-mono bg-gray-200 px-1">→</span> +5s
              </p>
              <p>
                <span className="font-mono bg-gray-200 px-1">←</span> -5s
              </p>
            </div>
          </Card>

          {/* Share Button */}
          <Button variant="secondary" className="w-full" onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied!');
          }}>
            Share Episode
          </Button>
        </div>
      </div>
    </div>
  );
}
