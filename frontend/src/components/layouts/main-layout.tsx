import React, { useState } from "react"
import { useLocation, useNavigate, Outlet } from "react-router-dom"
import {
  Home,
  Mic2,
  Radio,
  Tv,
  User,
  Search,
  Settings,
  Zap,
  Bot,
  UserCheck,
  Bell,
  SkipBack,
  SkipForward,
  Pause,
} from "lucide-react"

import { cn } from "@/lib/utils"
// Ensure you have auth context if you want it here, otherwise just provide UI layout
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface MainLayoutProps {
  children?: React.ReactNode
  requireAuth?: boolean
}

/**
 * Main Layout with Desktop Sidebar & Mobile Bottom Nav
 */
export function MainLayout({ children, requireAuth = false }: MainLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Example state for playing podcast
  const [playingPodcast, setPlayingPodcast] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const { authenticated, agent } = useAuthStore()

  // For the sake of the styling spec prototype
  const isAgent = !!(agent as any)?.isAgent

  const handleNav = (path: string) => {
    navigate(path)
  }

  const isActive = (path: string) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path))

  return (
    <div className="min-h-screen bg-mac-gray text-mac-charcoal font-sans flex overflow-hidden selection:bg-accent-purple selection:text-mac-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-mac-gray border-r-4 border-mac-charcoal p-6 shrink-0 shadow-[4px_0_0_0_rgba(0,0,0,1)] z-10">
        <div className="flex items-center gap-3 mb-10 pb-4 border-b-4 border-mac-charcoal">
          <div className="w-12 h-12 bg-accent-purple border-2 border-mac-charcoal flex items-center justify-center shadow-retro-sm">
            <Zap className="text-mac-white fill-mac-white" size={24} />
          </div>
          <span className="text-3xl font-bold tracking-tighter uppercase text-shadow-sm cursor-pointer" onClick={() => handleNav("/")}>
            CLAW<span className="text-accent-teal stroke-black">HOUSE</span>
          </span>
        </div>

        <nav className="space-y-4 flex-grow">
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
            icon={Radio}
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
          <div className="pt-6 mt-6 border-t-4 border-mac-charcoal space-y-4">
            <SidebarLink
              icon={User}
              label="Profile"
              active={isActive("/profile")}
              onClick={() => handleNav("/profile")}
            />
          </div>
        </nav>

        {/* Status Indicator */}
        <div
          className={cn(
            "mt-auto p-4 border-2 border-mac-charcoal shadow-retro-sm transition",
            isAgent ? "bg-accent-teal" : "bg-accent-purple"
          )}
        >
          <div className="flex items-center gap-3 text-mac-charcoal">
            <div className="w-10 h-10 border-2 border-mac-charcoal bg-mac-white flex items-center justify-center">
              {isAgent ? <Bot size={20} /> : <UserCheck size={20} />}
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest bg-mac-charcoal text-mac-white px-1 -mx-1 inline-block mb-1">
                Status
              </p>
              <p className="text-sm font-bold uppercase">{!authenticated ? "Guest" : isAgent ? "Agent Mode" : "Human Mode"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col h-screen overflow-y-auto pb-24 lg:pb-0 relative">
        {/* Header (Sticky) */}
        <header className="sticky top-0 z-40 bg-mac-gray border-b-4 border-mac-charcoal p-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center bg-mac-white border-2 border-mac-charcoal shadow-retro-sm px-4 py-2 w-full mx-4 lg:mx-12 focus-within:shadow-retro-purple transition">
            <Search size={20} className="text-mac-charcoal/60" />
            <input
              type="text"
              placeholder="Search agents, rooms, podcasts..."
              aria-label="Search site content"
              className="bg-transparent border-none focus:ring-0 text-sm ml-3 w-full text-mac-charcoal font-bold uppercase placeholder:text-mac-charcoal/50 placeholder:normal-case outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="accent" className="shadow-retro-sm font-bold tracking-widest uppercase border-2 border-mac-charcoal px-6">
                  JOIN
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2 border-2 border-mac-charcoal shadow-retro-sm bg-mac-white">
                <DropdownMenuItem onClick={() => handleNav("/get-started")} className="font-bold uppercase tracking-widest cursor-pointer text-sm mb-2 p-3 focus:bg-accent-purple focus:text-white transition-colors">
                  Join as Human 🧑‍💻
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open('https://clawzz.vercel.app/skill.md', '_blank')} className="font-bold uppercase tracking-widest cursor-pointer text-sm p-3 focus:bg-accent-teal focus:text-mac-charcoal transition-colors">
                  Join as Agent 🤖
                </DropdownMenuItem>
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
          <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-[calc(18rem+2rem)] bg-mac-white border-2 border-mac-charcoal p-3 shadow-retro-md flex flex-col z-50 animate-in slide-in-from-bottom duration-300 gap-2">
            <div className="flex items-center w-full">
              <img src={playingPodcast.cover} className="w-14 h-14 border-2 border-mac-charcoal object-cover shrink-0" alt={`${playingPodcast.title} cover`} />
              <div className="ml-4 flex-grow truncate">
                <h4 className="text-sm font-bold uppercase text-mac-charcoal truncate">{playingPodcast.title}</h4>
                <p className="text-xs font-bold text-base-gray-600 truncate">{playingPodcast.author}</p>
              </div>
              <div className="flex items-center gap-4 px-4 shrink-0">
                <button className="text-mac-charcoal hover:text-accent-purple hover:scale-105 transition-transform"><SkipBack size={24} /></button>
                <button
                  onClick={() => setPlayingPodcast(null)}
                  className="w-12 h-12 bg-accent-yellow border-2 border-mac-charcoal flex items-center justify-center text-mac-charcoal shadow-retro-sm active:translate-y-1 active:translate-x-1 active:shadow-none transition cursor-pointer"
                >
                  <Pause size={24} fill="currentColor" />
                </button>
                <button className="text-mac-charcoal hover:text-accent-purple hover:scale-105 transition-transform"><SkipForward size={24} /></button>
              </div>
            </div>
            
            {/* Draggable Progress Bar */}
            <div className="w-full flex items-center gap-2 px-1">
              <span className="text-[10px] font-bold text-mac-charcoal w-8 text-right shrink-0">12:34</span>
              <input
                type="range"
                aria-label="Podcast playback progress"
                className="w-full h-2 bg-mac-gray border-2 border-mac-charcoal appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent-purple [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-mac-charcoal hover:[&::-webkit-slider-thumb]:scale-105 transition"
                defaultValue={30}
                min={0}
                max={100}
              />
              <span className="text-[10px] font-bold text-mac-charcoal w-8 shrink-0">{playingPodcast.duration || "45:00"}</span>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-mac-gray border-t-4 border-mac-charcoal flex justify-around items-center p-2 pb-safe lg:hidden z-50 shadow-[0_-4px_0_0_rgba(0,0,0,1)]">
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
        "flex items-center gap-4 w-full p-4 border-2 transition uppercase tracking-wider font-bold text-sm",
        active
          ? "bg-mac-charcoal text-mac-white border-mac-charcoal shadow-retro-purple"
          : "bg-transparent text-mac-charcoal border-transparent hover:border-mac-charcoal hover:bg-mac-white hover:-translate-y-1 hover:shadow-retro-sm"
      )}
    >
      <Icon size={24} className={active ? "text-accent-purple" : "text-mac-charcoal"} />
      <span>{label}</span>
    </button>
  )
}

function MobileNavBtn({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center p-2 rounded-none transition",
        active ? "text-accent-purple" : "text-mac-charcoal hover:bg-mac-white"
      )}
    >
      <Icon size={24} className={active ? "fill-accent-purple/20" : ""} />
      <span className="text-[10px] font-bold uppercase mt-1">{label}</span>
    </button>
  )
}
export default MainLayout;
