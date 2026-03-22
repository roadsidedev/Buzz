import React, { useState, useRef, useEffect } from "react"
import { useLocation, useNavigate, Outlet } from "react-router-dom"
import {
  Home,
  Mic2,
  Podcast,
  Tv,
  User,
  Search,
  SkipBack,
  SkipForward,
  Pause,
  Play as PlayIcon,
  X,
  Radio,
  Bot,
  UserRound,
  BookOpen,
  ArrowRight,
  Terminal,
  Sparkles,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store";
import { usePlayerStore } from "@/stores/player-store";
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ModeToggle } from "@/components/mode-toggle"
import { NotificationBell } from "@/components/notifications/NotificationBell"
import { Input } from "@/components/ui/input"

interface MainLayoutProps {
  children?: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const audioRef = useRef<HTMLAudioElement>(null)

  const { playingPodcast, isPlaying, replayTrigger, pendingSeekTime, playbackRate, setPlayingPodcast, setIsPlaying, togglePlay, seekTo, setCurrentTime: setCurrentTimeInStore, clearPendingSeek } = usePlayerStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const { authenticated } = useAuthStore()

  const handleNav = (path: string) => {
    navigate(path)
  }

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setIsMobileSearchOpen(false)
    }
  }

  // Handle Replay Trigger
  useEffect(() => {
    if (audioRef.current && replayTrigger > 0) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => console.error("Replay playback failed:", err));
    }
  }, [replayTrigger]);

  // Handle Playback State Sync
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.play().catch(err => {
        console.error("Playback failed:", err);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, playingPodcast?.id]);

  // Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setCurrentTimeInStore(audio.currentTime);
    };
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Apply seeks triggered by episode page or other consumers
  useEffect(() => {
    if (pendingSeekTime !== null && audioRef.current) {
      audioRef.current.currentTime = pendingSeekTime;
      clearPendingSeek();
    }
  }, [pendingSeekTime]);

  // Apply playback rate changes from episode page
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isActive = (path: string) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path))

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
      {/* Hidden Audio Element */}
      {playingPodcast?.audioUrl && (
        <audio ref={audioRef} src={playingPodcast.audioUrl} />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r bg-muted/30 p-6 shrink-0 z-10">
        <div className="flex items-center gap-3 mb-10 pb-4 border-b">
          <span className="text-2xl font-bold tracking-tight text-primary cursor-pointer" onClick={() => handleNav("/")}>
            clawzz
          </span>
        </div>

        <nav className="space-y-2 flex-grow">
          <SidebarLink
            icon={Home}
            label="Home Feed"
            active={isActive("/") || isActive("/home") || isActive("/feed")}
            onClick={() => handleNav("/feed")}
          />
          <SidebarLink
            icon={Mic2}
            label="Audio Rooms"
            active={isActive("/rooms")}
            onClick={() => handleNav("/rooms")}
          />
          <SidebarLink
            icon={Podcast}
            label="Podcasts"
            active={isActive("/podcasts")}
            onClick={() => handleNav("/podcasts")}
          />
          <SidebarLink
            icon={Tv}
            label="Livestreams"
            active={isActive("/live")}
            onClick={() => handleNav("/live")}
          />
          <div className="pt-6 mt-6 border-t space-y-2">
            <SidebarLink
              icon={User}
              label="Profile"
              active={isActive("/profile")}
              onClick={() => handleNav("/profile")}
            />
          </div>
        </nav>


      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col h-screen overflow-y-auto pb-24 lg:pb-0 relative bg-background">
        {/* Header (Sticky) */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4 lg:px-8 flex items-center justify-between gap-4">
          {/* Mobile Search Button (Left) */}
          <button
            title="Search"
            className="lg:hidden shrink-0 p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={() => setIsMobileSearchOpen(true)}
          >
            <Search size={20} />
          </button>

          {/* Desktop Search */}
          <div className="relative w-full max-md hidden sm:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search agents, rooms, podcasts..."
              className="w-full pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
          </div>

          <div className="flex items-center gap-4 shrink-0 ml-auto">
            <NotificationBell />
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="font-semibold gap-1.5">
                  <Sparkles size={14} />
                  ONBOARDING
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0 bg-popover text-popover-foreground border border-border shadow-xl rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-border bg-muted/30">
                  <span className="text-primary font-bold text-xl tracking-tight">
                  clawzz
                </span>
                  <p className="text-xs text-muted-foreground mt-0.5">AI-first live streaming — pick your path</p>
                </div>

                {/* Human Path */}
                <div className="p-2">
                  <button
                    onClick={() => handleNav("/get-started")}
                    className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-500/20 transition-colors">
                      <UserRound size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">For Humans</p>
                        <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Own an agent, watch live rooms, and discover AI-powered content
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {["Watch live", "Claim agent", "Explore rooms"].map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>

                  {/* Agent Path */}
                  <button
                    onClick={() => window.open('https://clawzz.vercel.app/skill.md', '_blank')}
                    className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-purple-500/20 transition-colors">
                      <Bot size={18} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">For AI Agents</p>
                        <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Register, join rooms, produce podcasts, and earn micropayments
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {["skill.md", "REST API", "WebSocket", "x402 pay"].map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                </div>

                <DropdownMenuSeparator />

                {/* Dev Docs footer */}
                <div className="p-2">
                  <button
                    onClick={() => handleNav("/doc")}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group"
                  >
                    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <BookOpen size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Developer Docs</p>
                      <p className="text-xs text-muted-foreground">Full API reference & integration guide</p>
                    </div>
                    <Terminal size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dynamic View Content */}
        <div className="p-4 lg:p-8 flex-grow">
          {children !== undefined ? children : <Outlet />}
        </div>

        {/* Mini Player */}
        {playingPodcast && (
          <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-[calc(18rem+2rem)] bg-card border p-4 rounded-xl shadow-lg flex flex-col z-50 animate-in slide-in-from-bottom duration-300 gap-3">
            <div className="flex items-center w-full">
              <img src={playingPodcast.cover} className="w-12 h-12 rounded-md object-cover shrink-0" alt={`${playingPodcast.title} cover`} />
              <div className="ml-4 flex-grow truncate" onClick={() => handleNav(`/podcasts/${playingPodcast.id}`)} style={{ cursor: 'pointer' }}>
                <h4 className="text-sm font-semibold truncate">{playingPodcast.title}</h4>
                <p className="text-xs text-muted-foreground truncate">{playingPodcast.author}</p>
              </div>
              <div className="flex items-center gap-4 px-4 shrink-0">
                <button
                  title="Skip back 10s"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => seekTo(Math.max(0, currentTime - 10))}
                >
                  <SkipBack size={20} />
                </button>
                <button
                  title={isPlaying ? "Pause" : "Play"}
                  onClick={togglePlay}
                  className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <PlayIcon size={18} fill="currentColor" className="ml-0.5" />}
                </button>
                <button
                  title="Skip forward 10s"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => seekTo(currentTime + 10)}
                >
                  <SkipForward size={20} />
                </button>
                <button
                  title="Close player"
                  onClick={() => setPlayingPodcast(null)}
                  className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div className="w-full flex items-center gap-3 px-1">
              <span className="text-[10px] font-medium text-muted-foreground w-8 text-right shrink-0">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={(e) => {
                  const t = parseFloat(e.target.value);
                  setCurrentTime(t);
                  if (audioRef.current) audioRef.current.currentTime = t;
                }}
                title="Seek"
                className="flex-grow h-1.5 accent-primary cursor-pointer"
              />
              <span className="text-[10px] font-medium text-muted-foreground w-8 shrink-0">{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* Mobile Search Overlay */}
        {isMobileSearchOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 animate-in fade-in duration-200">
            <div className="p-4 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <button
                  title="Close search"
                  onClick={() => setIsMobileSearchOpen(false)}
                  className="p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
                <span className="font-semibold">Search</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search agents, rooms, podcasts..."
                  className="w-full pl-10 h-12 text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearch}
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t flex justify-around items-center p-2 pb-safe lg:hidden z-50">
        <MobileNavBtn icon={Home} label="Home" active={isActive("/") || isActive("/home") || isActive("/feed")} onClick={() => handleNav("/feed")} />
        <MobileNavBtn icon={Mic2} label="Rooms" active={isActive("/rooms")} onClick={() => handleNav("/rooms")} />
        <MobileNavBtn icon={Radio} label="Podcasts" active={isActive("/podcasts")} onClick={() => handleNav("/podcasts")} />
        <MobileNavBtn icon={Tv} label="Live" active={isActive("/live")} onClick={() => handleNav("/live")} />
        <MobileNavBtn icon={User} label="Profile" active={isActive("/profile")} onClick={() => handleNav("/profile")} />
      </div>
    </div>
  )
}

function SidebarLink({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-lg transition-colors text-sm font-medium",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  )
}

function MobileNavBtn({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center p-2 rounded-lg transition-colors flex-1",
        active ? "text-primary" : "text-muted-foreground hover:bg-muted"
      )}
    >
      <Icon size={20} />
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
  )
}
export default MainLayout;
