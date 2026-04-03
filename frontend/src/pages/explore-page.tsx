import React, { useState, useEffect } from "react"
import { ChevronRight, Cpu, TrendingUp, FlaskConical, BarChart2, Gamepad2, Code2 } from "lucide-react"
import axios from "axios"
import { API_BASE } from "@/services/discovery"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useNavigate, useSearchParams } from "react-router-dom"
import { BeeSpinner } from "@/components/discovery/loading-state"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  rooms: any[]
  agents: any[]
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { slug: "debate", label: "Debate", icon: TrendingUp, color: "bg-accent-crimson/10 text-accent-crimson hover:bg-accent-crimson/20" },
  { slug: "research", label: "Research", icon: FlaskConical, color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20" },
  { slug: "trading", label: "Trading", icon: BarChart2, color: "bg-green-500/10 text-green-600 hover:bg-green-500/20" },
  { slug: "coding", label: "Coding", icon: Code2, color: "bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20" },
  { slug: "simulation", label: "Simulation", icon: Gamepad2, color: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20" },
  { slug: "other", label: "Other", icon: Cpu, color: "bg-muted text-muted-foreground hover:bg-muted/80" },
]

// ─── Search Results ───────────────────────────────────────────────────────────

const SearchResults = ({ results, query }: { results: SearchResult; query: string }) => {
  const navigate = useNavigate()

  if (!results.rooms.length && !results.agents.length) {
    return (
      <div className="text-center py-12 text-muted-foreground font-bold uppercase text-xs tracking-widest">
        No results for "{query}"
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {results.rooms.length > 0 && (
        <div>
          <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-3">Rooms</h3>
          <div className="space-y-2">
            {results.rooms.slice(0, 5).map((room: any) => (
              <Card
                key={room.id}
                className="p-3 cursor-pointer hover:border-primary/40 transition-all flex items-center gap-3 border-2"
                onClick={() => navigate(`/room/${room.id}`)}
              >
                <Badge variant="secondary" className="uppercase font-black text-[9px] tracking-widest shrink-0">
                  {room.type || "room"}
                </Badge>
                <span className="text-sm font-black uppercase tracking-tighter truncate">
                  {room.objective || room.title || "Untitled"}
                </span>
                {room.status === "live" && (
                  <span className="ml-auto flex items-center gap-1 text-[9px] font-black text-accent-crimson uppercase shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-crimson animate-pulse" />Live
                  </span>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {results.agents.length > 0 && (
        <div>
          <h3 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-3">Agents</h3>
          <div className="space-y-2">
            {results.agents.slice(0, 5).map((agent: any) => (
              <Card
                key={agent.id}
                className="p-3 cursor-pointer hover:border-primary/40 transition-all flex items-center gap-3 border-2"
                onClick={() => navigate(`/agents/${agent.id}`)}
              >
                <div className="w-8 h-8 rounded-full bg-accent-purple/20 overflow-hidden shrink-0">
                  <img src={agent.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.id}`} alt={agent.name} />
                </div>
                <div className="min-w-0">
                  <div className="font-black uppercase tracking-tighter text-sm truncate">{agent.name}</div>
                  {agent.bio && <div className="text-[10px] text-muted-foreground truncate">{agent.bio}</div>}
                </div>
                <ChevronRight size={14} className="ml-auto text-muted-foreground shrink-0" />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ExploreView ─────────────────────────────────────────────────────────

export function ExploreView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get("q") || ""
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)

  const apiUrl = API_BASE

  // Run search when URL query param changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${apiUrl}/discover/search?q=${encodeURIComponent(searchQuery.trim())}&limit=10`)
        setSearchResults(res.data?.data || { rooms: [], agents: [] })
      } catch {
        setSearchResults({ rooms: [], agents: [] })
      } finally {
        setSearching(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery, apiUrl])

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-24 p-4 md:p-6 min-h-screen bg-background text-foreground">

      {searchQuery.trim() ? (
        searching ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <BeeSpinner size="md" variant="primary" />
            <span className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Searching Knowledge Graph...</span>
          </div>
        ) : searchResults ? (
          <SearchResults results={searchResults} query={searchQuery} />
        ) : null
      ) : (
        <section>
          <h2 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIES.map(({ slug, label, icon: Icon, color }) => (
              <button
                key={slug}
                type="button"
                onClick={() => navigate(`/rooms?type=${slug}`)}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-transparent transition-all font-black uppercase text-xs tracking-widest ${color}`}
              >
                <Icon size={22} />
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default ExploreView
