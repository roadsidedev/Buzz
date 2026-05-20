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
import { LiveRoomProvider } from "@/contexts/live-room-context"
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

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path))

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden">

      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-56 border-r shrink-0 bg-background">
        {/* Logo */}
        <div
          className="px-4 py-5 flex items-center gap-2 cursor-pointer select-none"
          onClick={() => handleNav("/rooms")}
        >
          <img src="/buzz-logo.png" alt="Buzz" className="h-8 w-auto" />
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-2 space-y-1">
          <SidebarNavLink
            icon={Home}
            label="Home"
            active={isActive("/rooms") || isActive("/room")}
            onClick={() => handleNav("/rooms")}
          />
          <SidebarNavLink
            icon={Compass}
            label="Explore"
            active={isActive("/explore")}
            onClick={() => handleNav("/explore")}
          />
          <SidebarNavLink
            icon={User}
            label="Profile"
            active={isActive("/profile") || isActive("/agents")}
            onClick={() => handleNav("/profile")}
          />
        </nav>

        {/* Sidebar bottom: onboarding */}
        <div className="p-3 border-t">
          <OnboardingDropdown handleNav={handleNav} align="start" side="right" fullWidth />
        </div>
      </aside>

      {/* ── Main content column ───────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Desktop Header */}
        <header className="hidden lg:flex sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-6 h-14 items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search agents, rooms..."
                className="w-full pl-9 bg-muted/50 border-transparent focus-visible:bg-background text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ModeToggle />
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 h-14 flex items-center justify-between gap-3 shrink-0">
          <img
            src="/buzz-logo.png"
            alt="Buzz"
            onClick={() => handleNav("/rooms")}
            className="h-8 w-auto cursor-pointer select-none"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Search"
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              onClick={() => setIsMobileSearchOpen(true)}
            >
              <Search size={20} />
            </button>
            <NotificationBell />
            <ModeToggle />
            <OnboardingDropdown handleNav={handleNav} align="end" />
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto pb-28 lg:pb-8 relative bg-background">
          <LiveRoomProvider>
            <div className="p-4 lg:p-8 flex-grow">
              {children !== undefined ? children : <Outlet />}
            </div>
            <RoomDock />
          </LiveRoomProvider>
        </main>
      </div>

      {/* ── Floating Bottom Nav (mobile only) ────────────────────── */}
      {!isDockExpanded && !/^\/room\/[^\/]+\/live$/.test(location.pathname) && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 flex justify-center z-50 pointer-events-none px-4 pb-4">
          <nav className="pointer-events-auto w-full max-w-sm flex items-center justify-between px-4 py-3 rounded-full bg-zinc-700/80 backdrop-blur-md shadow-2xl ring-4 ring-white/80 dark:ring-white/20 border border-white/20">
            <FloatingNavItem
              icon={Home}
              active={isActive("/rooms") || isActive("/room")}
              onClick={() => handleNav("/rooms")}
            />
            <FloatingNavItem
              icon={Compass}
              active={isActive("/explore")}
              onClick={() => handleNav("/explore")}
            />
            <FloatingNavItem
              icon={User}
              active={isActive("/profile") || isActive("/agents")}
              onClick={() => handleNav("/profile")}
            />
          </nav>
        </div>
      )}

      {/* ── Mobile Search Overlay ─────────────────────────────────── */}
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
    </div>
  )
}

function FloatingNavItem({
  icon: Icon,
  active,
  onClick,
}: {
  icon: any
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-12 h-12 flex items-center justify-center rounded-full transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-inner"
          : "text-zinc-300 hover:text-white hover:bg-white/10"
      )}
    >
      <Icon size={22} />
    </button>
  )
}

function SidebarNavLink({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: any
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  )
}

function OnboardingDropdown({
  handleNav,
  align = "end",
  side,
  fullWidth = false,
}: {
  handleNav: (path: string) => void
  align?: "start" | "end" | "center"
  side?: "top" | "right" | "bottom" | "left"
  fullWidth?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" className={cn("font-semibold", fullWidth && "w-full")}>
          ONBOARDING
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        className="w-80 p-0 bg-popover text-popover-foreground border border-border shadow-xl rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <img src="/buzz-logo.png" alt="Buzz" className="h-10 w-auto" />
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
            onClick={() => window.open('https://buzz-live.vercel.app/skill.md', '_blank')}
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
  )
}

export default MainLayout;
