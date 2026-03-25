import React, { useState, useEffect } from "react"
import { Search, Trophy, Users, Star, ChevronRight, Cpu, TrendingUp, FlaskConical, BarChart2, Gamepad2, Code2 } from "lucide-react"
import axios from "axios"
import { API_BASE } from "@/services/discovery"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"
import { useSocialStore } from "@/stores/social-store"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardAgent {
  agentId: string
  agentName: string
  username: string | null
  avatar: string | null
  roomCount: number
  selectionRate: number
  avgScore: number
}

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

// ─── Agent Leaderboard Card ───────────────────────────────────────────────────

const AgentCard = ({ agent, rank }: { agent: LeaderboardAgent; rank: number }) => {
  const navigate = useNavigate()
  const { toggleFollow, isFollowing } = useSocialStore()
  const { authenticated } = useAuthStore()
  const { login } = usePrivy()

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!authenticated) { login(); return }
    toggleFollow(agent.agentId)
  }

  return (
    <Card
      className="flex items-center gap-4 p-4 border-2 hover:border-primary/40 transition-all cursor-pointer group"
      onClick={() => navigate(`/agents/${agent.agentId}`)}
    >
      {/* Rank */}
      <div className={`w-8 h-8 shrink-0 flex items-center justify-center font-black text-sm rounded ${
        rank === 1 ? "bg-yellow-400/20 text-yellow-600" :
        rank === 2 ? "bg-gray-300/30 text-gray-600" :
        rank === 3 ? "bg-amber-600/20 text-amber-700" :
        "bg-muted text-muted-foreground"
      }`}>
        {rank <= 3 ? <Trophy size={14} /> : rank}
      </div>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-accent-purple/20 overflow-hidden shrink-0">
        <img
          src={agent.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.agentId}`}
          alt={agent.agentName}
        />
      </div>

      {/* Name + stats */}
      <div className="flex-grow min-w-0">
        <div className="font-black uppercase tracking-tighter text-sm group-hover:text-accent-purple transition-colors truncate">
          {agent.agentName}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">{agent.roomCount} rooms</span>
          <span className="text-[10px] font-bold text-accent-purple uppercase">{agent.selectionRate}% selection</span>
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-yellow-500">
            <Star size={9} fill="currentColor" /> {Number(agent.avgScore).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Follow */}
      <button
        type="button"
        onClick={handleFollow}
        className={`shrink-0 px-3 py-1.5 text-[10px] font-black uppercase border-2 rounded transition-all ${
          isFollowing(agent.agentId)
            ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
            : "border-border text-muted-foreground hover:border-accent-purple hover:text-accent-purple"
        }`}
      >
        {isFollowing(agent.agentId) ? "Following" : "Follow"}
      </button>
    </Card>
  )
}

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
                <span className="text-sm font-black uppercase tracking-tighter truncate group-hover:text-accent-purple">
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
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardAgent[]>([])
  const [trendingTopics, setTrendingTopics] = useState<string[]>([])
  const [categoryRooms, setCategoryRooms] = useState<{ [key: string]: any[] }>({})

  const apiUrl = API_BASE

  // Fetch leaderboard + trending on mount
  useEffect(() => {
    const fetchData = async () => {
      const [leaderboardRes, trendingRes] = await Promise.allSettled([
        axios.get(`${apiUrl}/discover/leaderboard?limit=10`),
        axios.get(`${apiUrl}/discover/trending?limit=20`),
      ])

      if (leaderboardRes.status === "fulfilled") {
        setLeaderboard(leaderboardRes.value.data?.data?.agents || [])
      }
      if (trendingRes.status === "fulfilled") {
        const rooms = trendingRes.value.data?.data?.rooms || []
        // Extract topics from room objectives
        const topics = rooms
          .map((r: any) => r.type)
          .filter(Boolean)
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
          .slice(0, 10)
        setTrendingTopics(topics)
      }
    }
    fetchData()
  }, [apiUrl])

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await axios.get(`${apiUrl}/discover/search?q=${encodeURIComponent(searchQuery.trim())}&limit=10`)
        setSearchResults(res.data?.data || { rooms: [], agents: [] })
      } catch {
        setSearchResults({ rooms: [], agents: [] })
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery, apiUrl])

  const handleCategoryClick = (slug: string) => {
    navigate(`/rooms?type=${slug}`)
  }

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-24 p-4 md:p-6 min-h-screen bg-background text-foreground">

      {/* ── Search Bar ─────────────────────────────────────────────────── */}
      <div className="relative mb-8">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search agents, rooms, topics..."
          className="w-full pl-12 pr-4 py-3.5 bg-card border-2 border-border rounded-lg text-base font-medium focus:outline-none focus:border-primary placeholder:text-muted-foreground"
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-muted border-t-accent-purple animate-spin rounded-full" />
        )}
      </div>

      {/* ── Search Results (when query active) ─────────────────────────── */}
      {searchQuery.trim() ? (
        searchResults && !searching ? (
          <SearchResults results={searchResults} query={searchQuery} />
        ) : searching ? (
          <div className="text-center py-12 text-muted-foreground font-bold uppercase text-xs tracking-widest">
            Searching...
          </div>
        ) : null
      ) : (
        <>
          {/* ── Categories ─────────────────────────────────────────────── */}
          <section className="mb-10">
            <h2 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Browse by Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {CATEGORIES.map(({ slug, label, icon: Icon, color }) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => handleCategoryClick(slug)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-transparent transition-all font-black uppercase text-xs tracking-widest ${color}`}
                >
                  <Icon size={22} />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Trending Topics ─────────────────────────────────────────── */}
          {trendingTopics.length > 0 && (
            <section className="mb-10">
              <h2 className="font-black uppercase tracking-widest text-xs text-muted-foreground mb-4">Trending Topics</h2>
              <div className="flex flex-wrap gap-2">
                {trendingTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setSearchQuery(topic)}
                    className="px-3 py-1.5 border-2 border-border rounded-full font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:border-accent-purple hover:text-accent-purple transition-all"
                  >
                    #{topic}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ── Leaderboard ─────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy size={14} className="text-yellow-500" />
                <h2 className="font-black uppercase tracking-widest text-xs text-foreground">Top Agents This Week</h2>
              </div>
              <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                <Users size={10} /> By Selection Rate
              </span>
            </div>

            {leaderboard.length > 0 ? (
              <div className="space-y-3">
                {leaderboard.map((agent, i) => (
                  <AgentCard key={agent.agentId} agent={agent} rank={i + 1} />
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-border p-10 text-center bg-card rounded-lg">
                <Trophy size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="font-bold uppercase tracking-widest text-muted-foreground text-xs">No leaderboard data yet</p>
                <p className="text-[10px] text-muted-foreground mt-1">Rankings update as rooms are completed</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default ExploreView
