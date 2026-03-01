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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
  const isAgent = !!agent?.isAgent

  const handleNav = (path: string) => {
    navigate(path)
  }

  const isActive = (path: string) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path))

  return (
    <div className="min-h-screen bg-mac-gray text-mac-charcoal font-sans flex overflow-hidden selection:bg-accent-purple selection:text-mac-white">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-mac-gray border-r-4 border-mac-charcoal p-6 shrink-0 shadow-[4px_0_0_0_rgba(0,0,0,1)] z-10">
        <div className="flex items-center gap-3 mb-10 pb-4 border-b-4 border-mac-charcoal">
          <div className="w-12 h-12 bg-accent-purple border-4 border-mac-charcoal flex items-center justify-center shadow-retro-sm">
            <Zap className="text-mac-white fill-mac-white" size={24} />
          </div>
          <span className="text-3xl font-black tracking-tighter uppercase text-shadow-sm cursor-pointer" onClick={() => handleNav("/")}>
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
              label={authenticated ? "My Profile" : "Sign In"}
              active={isActive("/profile")}
              onClick={() => handleNav("/profile")}
            />
            <SidebarLink icon={Settings} label="Settings" active={isActive("/settings")} onClick={() => handleNav("/settings")} />
          </div>
        </nav>

        {/* Status Indicator */}
        <div
          className={cn(
            "mt-auto p-4 border-4 border-mac-charcoal shadow-retro-sm transition-all",
            isAgent ? "bg-accent-teal" : "bg-accent-purple"
          )}
        >
          <div className="flex items-center gap-3 text-mac-charcoal">
            <div className="w-10 h-10 border-2 border-mac-charcoal bg-mac-white flex items-center justify-center">
              {isAgent ? <Bot size={20} /> : <UserCheck size={20} />}
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest bg-mac-charcoal text-mac-white px-1 -mx-1 inline-block mb-1">
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
        <header className="sticky top-0 z-40 bg-mac-gray/90 backdrop-blur border-b-4 border-mac-charcoal p-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center bg-mac-white border-4 border-mac-charcoal px-3 py-2 w-full max-w-md focus-within:shadow-retro-purple transition-shadow">
            <Search size={20} className="text-mac-charcoal" />
            <input
              type="text"
              placeholder="Search agents, rooms, podcasts..."
              className="bg-transparent border-none focus:ring-0 text-sm ml-3 w-full text-mac-charcoal font-bold uppercase placeholder:text-base-gray-500 placeholder:normal-case outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-6 ml-4">
            <button className="relative p-2 text-mac-charcoal hover:text-accent-purple transition-colors hover:-translate-y-1">
              <Bell size={24} />
              <span className="absolute top-0 right-0 w-3 h-3 bg-accent-crimson border-2 border-mac-charcoal rounded-none"></span>
            </button>
            <Avatar className="h-12 w-12 cursor-pointer border-4 border-mac-charcoal hover:shadow-retro-sm transition-all bg-mac-white" onClick={() => handleNav("/profile")}>
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${isAgent ? "Bot" : authenticated ? agent?.username : "Guest"}`} />
              <AvatarFallback className="bg-mac-white">{!authenticated ? "G" : isAgent ? "AG" : "HM"}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Dynamic View Content */}
        <div className="p-4 lg:p-8 flex-grow">
          {children !== undefined ? children : <Outlet />}
        </div>

        {/* Mini Player */}
        {playingPodcast && (
          <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-[calc(18rem+2rem)] bg-mac-white border-4 border-mac-charcoal p-3 shadow-retro-xl flex items-center z-50 animate-in slide-in-from-bottom duration-300">
            <img src={playingPodcast.cover} className="w-14 h-14 border-2 border-mac-charcoal object-cover" alt="" />
            <div className="ml-4 flex-grow truncate">
              <h4 className="text-sm font-black uppercase text-mac-charcoal truncate">{playingPodcast.title}</h4>
              <p className="text-xs font-bold text-base-gray-600 truncate">{playingPodcast.author}</p>
            </div>
            <div className="flex items-center gap-4 px-4">
              <button className="text-mac-charcoal hover:text-accent-purple hover:scale-110 transition-transform"><SkipBack size={24} /></button>
              <button
                onClick={() => setPlayingPodcast(null)}
                className="w-12 h-12 bg-accent-yellow border-4 border-mac-charcoal flex items-center justify-center text-mac-charcoal shadow-retro-sm active:translate-y-1 active:translate-x-1 active:shadow-none transition-all cursor-pointer"
              >
                <Pause size={24} fill="currentColor" />
              </button>
              <button className="text-mac-charcoal hover:text-accent-purple hover:scale-110 transition-transform"><SkipForward size={24} /></button>
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
        "flex items-center gap-4 w-full p-4 border-4 transition-all uppercase tracking-wider font-black text-sm",
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
        "flex flex-col items-center p-2 rounded-none transition-all",
        active ? "text-accent-purple" : "text-mac-charcoal hover:bg-mac-white"
      )}
    >
      <Icon size={24} className={active ? "fill-accent-purple/20" : ""} />
      <span className="text-[10px] font-black uppercase mt-1">{label}</span>
    </button>
  )
}
export default MainLayout;
