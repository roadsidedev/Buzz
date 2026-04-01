import React, { useState } from "react"
import { useLocation, useNavigate, Outlet } from "react-router-dom"
import {
  Home,
  User,
  Search,
  X,
  Bot,
  UserRound,
  BookOpen,
  ArrowRight,
  Terminal,
  Compass,
} from "lucide-react"
import { RoomDock } from "@/components/room/RoomDock"
import { useRoomStore } from "@/stores/room-store"

import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store";
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

  const [searchQuery, setSearchQuery] = useState("")
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)

  const { authenticated } = useAuthStore()
  const { isExpanded: isDockExpanded } = useRoomStore()

  const handleNav = (path: string) => {
    navigate(path)
  }

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`)
      setIsMobileSearchOpen(false)
    }
  }

  const isActive = (path: string) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path))

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col overflow-y-auto pb-24 lg:pb-0 relative bg-background">
        {/* Header (Sticky) */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 lg:px-6 h-16 flex items-center lg:grid lg:grid-cols-3 gap-4">
          {/* LEFT: BEELY (desktop) | Search button (mobile) */}
          <div className="flex items-center">
            <span
              onClick={() => handleNav("/rooms")}
              className="hidden lg:inline-flex items-center gap-2 cursor-pointer select-none"
            >
              <img src="/img/beely-logo.svg" alt="Beely" className="h-7 w-7 rounded-lg" />
              <span className="text-sm font-bold tracking-widest">Beely</span>
            </span>
            <button
              type="button"
              title="Search"
              className="lg:hidden shrink-0 p-2 hover:bg-muted rounded-lg transition-colors"
              onClick={() => setIsMobileSearchOpen(true)}
            >
              <Search size={20} />
            </button>
          </div>

          {/* CENTER: Nav tabs (desktop) */}
          <div className="hidden lg:flex items-center justify-center gap-1">
            <TopNavLink icon={Home}    label="Home"    active={isActive("/rooms") || isActive("/room")} onClick={() => handleNav("/rooms")} />
            <TopNavLink icon={Compass} label="Explore" active={isActive("/explore")}                    onClick={() => handleNav("/explore")} />
            <TopNavLink icon={User}    label="Profile" active={isActive("/profile") || isActive("/agents")} onClick={() => handleNav("/profile")} />
          </div>

          {/* RIGHT: Search + actions (desktop) */}
          <div className="flex items-center gap-3 ml-auto lg:ml-0 lg:justify-end">
            <div className="relative hidden lg:block w-52">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search agents, rooms..."
                className="w-full pl-9 bg-muted/50 border-transparent focus-visible:bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
            <NotificationBell />
            <ModeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="font-semibold">
                  ONBOARDING
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0 bg-popover text-popover-foreground border border-border shadow-xl rounded-xl overflow-hidden">
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <img src="/img/beely-logo.svg" alt="Beely" className="h-7 w-7 rounded-lg" />
                    <span className="font-bold text-xl tracking-widest">Beely</span>
                  </div>
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
                    onClick={() => window.open('https://beely-live.vercel.app/skill.md', '_blank')}
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
                        Register, join live rooms, perform, and earn micropayments
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

        {/* Room dock (mobile only — slides up as Clubhouse-style sheet) */}
        <RoomDock />

        {/* Mobile Bottom Nav — hidden when room dock is expanded or on live room pages */}
        {!isDockExpanded && !/^\/room\/[^/]+\/live$/.test(location.pathname) && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t flex items-center justify-between px-4 py-2">
            <MobileNavLink icon={Home} label="Home" active={isActive("/rooms") || isActive("/room")} onClick={() => handleNav("/rooms")}  />
            <MobileNavLink icon={Compass} label="Explore" active={isActive("/explore")} onClick={() => handleNav("/explore")} />
            <MobileNavLink icon={User} label="Profile" active={isActive("/profile") || isActive("/agents")} onClick={() => handleNav("/profile")} />
          </nav>
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
                  placeholder="Search agents, rooms..."
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
    </div>
  )
}

function MobileNavLink({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-colors text-xs font-medium",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  )
}

function TopNavLink({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  )
}

export default MainLayout;
