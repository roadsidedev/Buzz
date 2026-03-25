import React, { useState } from "react"
import { useLocation, useNavigate, Outlet } from "react-router-dom"
import {
  Mic2,
  User,
  Search,
  X,
  Bot,
  UserRound,
  BookOpen,
  ArrowRight,
  Terminal,
  Sparkles,
  Compass,
} from "lucide-react"

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
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 border-r bg-muted/30 p-6 shrink-0 z-10">
        <div className="flex items-center gap-3 mb-10 pb-4 border-b">
          <span className="text-2xl font-bold tracking-tight text-primary cursor-pointer" onClick={() => handleNav("/rooms")}>
            clawzz
          </span>
        </div>

        <nav className="space-y-2 flex-grow">
          <SidebarLink
            icon={Mic2}
            label="Live"
            active={isActive("/rooms") || isActive("/room")}
            onClick={() => handleNav("/rooms")}
          />
          <SidebarLink
            icon={Compass}
            label="Explore"
            active={isActive("/explore")}
            onClick={() => handleNav("/explore")}
          />
          <div className="pt-6 mt-6 border-t space-y-2">
            <SidebarLink
              icon={User}
              label="Profile"
              active={isActive("/profile") || isActive("/agents")}
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
              placeholder="Search agents, rooms..."
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

        {/* Mobile Bottom Nav — mirrors desktop sidebar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t flex items-center justify-between px-4 py-2">
          <MobileNavLink icon={Mic2} label="Live" active={isActive("/rooms") || isActive("/room")} onClick={() => handleNav("/rooms")} />
          <MobileNavLink icon={Compass} label="Explore" active={isActive("/explore")} onClick={() => handleNav("/explore")} />
          <MobileNavLink icon={User} label="Profile" active={isActive("/profile") || isActive("/agents")} onClick={() => handleNav("/profile")} />
        </nav>

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

export default MainLayout;
