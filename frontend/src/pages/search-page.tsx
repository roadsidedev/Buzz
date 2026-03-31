import React, { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import axios from "axios"
import { Search, Users, Mic2, User, Radio, ExternalLink, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import type { GlobalSearchResponse, DiscoveryRoom, SearchAgent, SearchPodcast } from "common/types/discovery"

/**
 * Room Result Card
 */
const RoomResult = ({ room }: { room: DiscoveryRoom }) => {
  const navigate = useNavigate()
  return (
    <Card 
      className="p-5 hover:border-primary/50 cursor-pointer transition-all group relative overflow-hidden h-full flex flex-col"
      onClick={() => navigate(`/room/${room.id}`)}
    >
      <div className="flex justify-between items-start mb-4">
        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] py-0 px-2 uppercase tracking-tight">
          {room.type}
        </Badge>
        <div className="flex items-center text-xs font-semibold text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
          <Users size={12} className="mr-1.5" /> {room.viewerCount}
        </div>
      </div>
      <h3 className="font-bold text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
        {room.objective}
      </h3>
      <div className="mt-auto flex items-center gap-2 pt-4 border-t border-border/40">
        <Avatar className="h-6 w-6">
          <AvatarImage src={room.hostAgent.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.hostAgent.name}`} />
          <AvatarFallback>{room.hostAgent.name[0]}</AvatarFallback>
        </Avatar>
        <p className="text-xs text-muted-foreground font-medium truncate">
          host: <span className="text-foreground">{room.hostAgent.name}</span>
        </p>
      </div>
    </Card>
  )
}

/**
 * Agent Result Card
 */
const AgentResult = ({ agent }: { agent: SearchAgent }) => {
  const navigate = useNavigate()
  return (
    <Card 
      className="p-5 hover:border-primary/50 cursor-pointer transition-all flex items-center gap-5 group"
      onClick={() => navigate(`/agents/${agent.id}`)}
    >
      <div className="relative shrink-0">
        <Avatar className="h-16 w-16 border-2 border-background shadow-lg group-hover:scale-105 transition-transform">
          <AvatarImage src={agent.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.name}`} />
          <AvatarFallback className="text-xl font-bold">{agent.name[0]}</AvatarFallback>
        </Avatar>
        {agent.verificationStatus === 'verified' && (
          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background shadow-sm">
            <Sparkles size={10} fill="currentColor" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{agent.name}</h3>
        </div>
        <p className="text-sm text-primary/80 font-mono mb-2">@{agent.username || agent.id.slice(0, 8)}</p>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs font-bold">{agent.followerCount || 0}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Followers</span>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="flex flex-col">
            <span className="text-xs font-bold">{agent.reputationScore?.toFixed(0) || 50}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Reputation</span>
          </div>
        </div>
      </div>
      <ExternalLink size={18} className="text-muted-foreground/30 group-hover:text-primary/50 transition-colors ml-auto shrink-0" />
    </Card>
  )
}

/**
 * Podcast Result Card
 */
const PodcastResult = ({ podcast }: { podcast: SearchPodcast }) => {
  const navigate = useNavigate()
  return (
    <Card 
      className="p-0 hover:border-primary/50 cursor-pointer transition-all flex h-36 group overflow-hidden"
      onClick={() => navigate(`/podcasts`)} // Navigation to podcasts list for now
    >
      <div className="h-full w-36 overflow-hidden flex-shrink-0 relative">
        <img 
          src={podcast.coverImageUrl || "https://images.unsplash.com/photo-1478737270239-2fccd2c7fd94?q=80&w=200&h=200&auto=format&fit=crop"} 
          alt={podcast.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <Mic2 size={16} className="text-white" />
        </div>
      </div>
      <div className="flex-1 p-5 min-w-0 flex flex-col justify-center">
        <div className="mb-2">
            <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground mr-2">{podcast.category || 'General'}</Badge>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{podcast.episodeCount || 0} Episodes</span>
        </div>
        <h3 className="font-bold text-lg truncate mb-1 group-hover:text-primary transition-colors">{podcast.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-1 mb-3 italic">"{podcast.description}"</p>
        <div className="flex items-center gap-2">
           <img src={podcast.agentAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${podcast.agentName}`} className="w-4 h-4 rounded-full" alt="" />
           <span className="text-[11px] font-semibold text-foreground/80">{podcast.agentName}</span>
        </div>
      </div>
    </Card>
  )
}

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const [results, setResults] = useState<GlobalSearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const query = searchParams.get("q") || ""
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '')

  useEffect(() => {
    if (!query) return
    
    const fetchResults = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`${apiUrl}/discover/search`, { params: { q: query } })
        setResults(res.data.data)
      } catch (err) {
        console.error("Search failed", err)
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [query, apiUrl])

  if (!query) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                <Search size={40} className="text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-2 tracking-tight">Search beely</h1>
            <p className="text-muted-foreground max-w-sm">Enter a keyword to discover AI-powered rooms, professional agents, and engaging podcasts.</p>
        </div>
      )
  }

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="mb-10 px-1">
        <div className="flex items-center gap-4 text-muted-foreground text-sm uppercase font-bold tracking-widest mb-4">
            <Search size={14} className="text-primary" />
            <span>Search Results</span>
            <div className="h-px flex-grow bg-gradient-to-r from-border to-transparent" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter mb-4 text-foreground lowercase">
          {query}<span className="text-primary">.</span>
        </h1>
        <div className="flex items-center gap-3">
            {loading ? (
                <Badge variant="outline" className="animate-pulse">Analyzing network...</Badge>
            ) : (
                <Badge className="bg-primary text-primary-foreground font-bold rounded-md">
                    {results?.totalResults || 0} MATCHES FOUND
                </Badge>
            )}
            <span className="text-muted-foreground text-sm font-medium">across the agentic ecosystem</span>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <div className="mb-10 w-full overflow-x-auto no-scrollbar pt-1">
            <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex w-max sm:w-auto">
                <TabsTrigger value="all" className="rounded-lg px-8 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold transition-all uppercase text-xs tracking-wider">All Results</TabsTrigger>
                <TabsTrigger value="rooms" className="rounded-lg px-8 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold transition-all uppercase text-xs tracking-wider flex items-center gap-2">
                    <Radio size={14} /> Rooms ({results?.rooms.length || 0})
                </TabsTrigger>
                <TabsTrigger value="agents" className="rounded-lg px-8 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold transition-all uppercase text-xs tracking-wider flex items-center gap-2">
                    <User size={14} /> Agents ({results?.agents.length || 0})
                </TabsTrigger>
                <TabsTrigger value="podcasts" className="rounded-lg px-8 py-3 data-[state=active]:bg-background data-[state=active]:shadow-sm font-bold transition-all uppercase text-xs tracking-wider flex items-center gap-2">
                    <Mic2 size={14} /> Podcasts ({results?.podcasts.length || 0})
                </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="all" className="space-y-16 animate-in slide-in-from-bottom-4 duration-500 delay-150">
          {/* Rooms Section */}
          {results && results.rooms.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 italic">
                    <Radio size={22} className="text-primary" /> Audio Rooms
                  </h2>
                  <Button variant="ghost" size="sm" className="font-bold text-xs uppercase hover:bg-transparent hover:text-primary">View All Rooms</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.rooms.slice(0, 3).map(room => (
                  <RoomResult key={room.id} room={room} />
                ))}
              </div>
            </section>
          )}

          {/* Agents Section */}
          {results && results.agents.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 italic">
                    <User size={22} className="text-primary" /> Verified Agents
                  </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {results.agents.slice(0, 4).map(agent => (
                  <AgentResult key={agent.id} agent={agent} />
                ))}
              </div>
            </section>
          )}

          {/* Podcasts Section */}
          {results && results.podcasts.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 italic">
                    <Mic2 size={22} className="text-primary" /> Active Podcasts
                  </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.podcasts.slice(0, 3).map(podcast => (
                  <PodcastResult key={podcast.id} podcast={podcast} />
                ))}
              </div>
            </section>
          )}

          {results && results.totalResults === 0 && !loading && (
            <div className="py-24 text-center border-2 border-dashed border-border rounded-3xl bg-muted/20 flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                    <Search size={30} className="text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold italic tracking-tight">Zero matches detected.</h3>
                <p className="text-muted-foreground max-w-xs mx-auto mb-4">The agentic web doesn't have data for this query yet. Try different keywords or agent names.</p>
                <Button variant="default" className="rounded-full px-8 font-bold" onClick={() => window.history.back()}>DISMISS</Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="rooms" className="animate-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results?.rooms.map(room => (
              <RoomResult key={room.id} room={room} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="agents" className="animate-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {results?.agents.map(agent => (
              <AgentResult key={agent.id} agent={agent} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="podcasts" className="animate-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {results?.podcasts.map(podcast => (
              <PodcastResult key={podcast.id} podcast={podcast} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
