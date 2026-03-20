/**
 * Episode Player Page
 *
 * Updated to use shadcn/ui components for consistent design.
 * Full-featured audio player with transcript display, playback controls,
 * and keyboard shortcuts.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Share2, 
  ArrowLeft,
  Clock,
  Headphones,
  FileText,
  Keyboard
} from 'lucide-react';
import { useEpisode } from '../hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EpisodePlayerPageProps {
  episodeId?: string;
}

export function EpisodePlayerPage({ episodeId: propsEpisodeId }: EpisodePlayerPageProps) {
  const params = useParams();
  const navigate = useNavigate();
  const episodeId = propsEpisodeId || params.id;
  const { episode, isLoading, error, isGenerating, progress } = useEpisode(episodeId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(true);

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(console.error);
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setPlaybackRate(rate);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [episode?.audioUrl]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayback();
      }
      if (e.code === 'ArrowRight') {
        if (audioRef.current) audioRef.current.currentTime += 5;
      }
      if (e.code === 'ArrowLeft') {
        if (audioRef.current) audioRef.current.currentTime -= 5;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground font-medium">Loading episode...</p>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive text-center">Episode Not Found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">{error?.message || "This episode could not be loaded."}</p>
            <Button variant="secondary" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft size={16} /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8 animate-in fade-in duration-500">
      {/* Back Button */}
      <div className="max-w-6xl mx-auto mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} /> Back to Podcasts
        </Button>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Player & Transcript */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <h1 className="text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none">{episode.title}</h1>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={episode.status === 'ready' ? 'default' : 'outline'} className="uppercase font-bold tracking-wider">
                {episode.status}
              </Badge>
              {episode.duration && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                  <Clock size={14} /> {formatTime(episode.duration)}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                <Headphones size={14} /> {episode.listenCount || 0} plays
              </div>
            </div>
          </div>

          {isGenerating && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider text-primary">
                  <span>Generating Episode</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-primary/10 rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-xs text-muted-foreground">The orchestrator is synthesizing audio and generating the transcript. This may take a minute.</p>
              </CardContent>
            </Card>
          )}

          {/* Audio Player Card */}
          {episode.audioUrl && (
            <Card className="shadow-xl overflow-hidden border-2">
              <div className="bg-muted/30 p-6 space-y-6">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  <Play size={12} fill="currentColor" /> Currently Playing
                </div>

                <audio ref={audioRef} src={episode.audioUrl} />

                {/* Custom Progress Bar */}
                <div className="space-y-3">
                  <input
                    type="range"
                    min="0"
                    max={episode.duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    disabled={isGenerating}
                    className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs font-mono font-bold text-muted-foreground">
                    <span>{formatTime(currentTime)}</span>
                    <span>{episode.duration ? formatTime(episode.duration) : '—'}</span>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="flex items-center gap-4">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="rounded-full h-10 w-10 border-2"
                      onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 15 }}
                      disabled={isGenerating || !episode.audioUrl}
                    >
                      <RotateCcw size={18} />
                    </Button>
                    
                    <Button
                      size="icon"
                      className="h-14 w-14 rounded-full shadow-lg shadow-primary/20 transition-transform active:scale-95"
                      onClick={togglePlayback}
                      disabled={isGenerating || !episode.audioUrl}
                    >
                      {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                    </Button>

                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="rounded-full h-10 w-10 border-2"
                      onClick={() => { if (audioRef.current) audioRef.current.currentTime += 15 }}
                      disabled={isGenerating || !episode.audioUrl}
                    >
                      <RotateCw size={18} />
                    </Button>
                  </div>

                  <Separator orientation="vertical" className="hidden sm:block h-10" />

                  <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-full border">
                    {[0.75, 1, 1.5, 2].map((rate) => (
                      <Button
                        key={rate}
                        variant={playbackRate === rate ? "secondary" : "ghost"}
                        size="sm"
                        className={cn(
                          "rounded-full h-8 px-3 text-[10px] font-black uppercase tracking-wider",
                          playbackRate === rate && "bg-background shadow-sm"
                        )}
                        onClick={() => handlePlaybackRateChange(rate)}
                        disabled={isGenerating || !episode.audioUrl}
                      >
                        {rate}x
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Transcript Card */}
          {episode.transcript && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText size={18} className="text-primary" />
                  Transcript
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="text-xs font-bold uppercase"
                >
                  {showTranscript ? 'Hide' : 'Show'}
                </Button>
              </CardHeader>
              <Separator />
              {showTranscript && (
                <ScrollArea className="h-[400px]">
                  <CardContent className="p-6 pt-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium">
                        {episode.transcript}
                      </p>
                    </div>
                  </CardContent>
                </ScrollArea>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Episode Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Episode Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Published On</span>
                <p className="font-bold">{new Date(episode.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
              </div>
              <Separator />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Description</span>
                <p className="text-sm text-muted-foreground leading-snug">{episode.description || "No description provided for this episode."}</p>
              </div>
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card className="bg-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Keyboard size={14} /> Shortcuts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Play/Pause</span>
                <Badge variant="outline" className="font-mono bg-background">Space</Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Forward 5s</span>
                <Badge variant="outline" className="font-mono bg-background">→</Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium">Backward 5s</span>
                <Badge variant="outline" className="font-mono bg-background">←</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Button 
            className="w-full h-12 font-bold uppercase gap-2 shadow-lg hover:shadow-primary/10 transition-all" 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('Episode link copied to clipboard!');
            }}
          >
            <Share2 size={18} /> Share Episode
          </Button>
        </div>
      </div>
    </div>
  );
}
