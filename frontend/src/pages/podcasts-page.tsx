import React, { useState, useEffect } from "react"
import { Play, Heart, Share2, DollarSign, Bookmark, SkipBack, Headphones } from "lucide-react"
import axios from "axios"
import { useAuthStore } from "@/stores/auth-store"
import { usePlayerStore } from "@/stores/player-store"
import { useSocialStore } from "@/stores/social-store"
import { usePrivy } from "@privy-io/react-auth"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PodcastsView() {
  const [podcasts, setPodcasts] = useState<any[]>([])
  const [featured, setFeatured] = useState<any | null>(null)
  const [newArrival, setNewArrival] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '')

  const { authenticated } = useAuthStore()
  const { setPlayingPodcast, replay } = usePlayerStore()
  const { toggleLike, toggleSave, isLiked, isSaved } = useSocialStore()
  const { login } = usePrivy()

  useEffect(() => {
    const fetchPodcasts = async () => {
      try {
        const [trendingRes, newArrivalsRes] = await Promise.all([
          axios.get(`${apiUrl}/podcasts/trending`),
          axios.get(`${apiUrl}/podcasts/new-arrivals`),
        ])
        const trending: any[] = trendingRes.data?.data?.podcasts || []
        const arrivals: any[] = newArrivalsRes.data?.data?.podcasts || []
        // Featured = #1 by all-time listens
        setFeatured(trending[0] || null)
        // New Arrival = hottest recent podcast; skip if it's the same as featured
        const arrival = arrivals.find((p) => p.id !== trending[0]?.id) || arrivals[0] || null
        setNewArrival(arrival)
        setPodcasts(trending)
      } catch {
        setPodcasts([])
      } finally {
        setLoading(false)
      }
    }
    fetchPodcasts()
  }, [apiUrl])

  const handlePlay = (pod: any) => {
    setPlayingPodcast({
      id: pod.id,
      title: pod.title,
      author: pod.author || "Agent_Unknown",
      cover: pod.coverImageUrl || pod.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=200",
      duration: pod.duration,
      audioUrl: pod.audioUrl
    });
  }

  const handleShare = async (pod: any) => {
    const shareUrl = `${window.location.origin}/podcasts/${pod.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  const requireLoginForAction = (e: React.MouseEvent, actionName: string, pod: any) => {
    e.stopPropagation();
    if (!authenticated) {
      console.log(`Must be logged in to ${actionName}`)
      login()
    } else {
      // Action dispatched
      console.log(`${actionName} action for podcast ${pod.id}`);
      if (actionName === 'Share') {
        handleShare(pod);
      } else if (actionName === 'Like') {
        toggleLike(pod.id);
      } else if (actionName === 'Tip') {
        alert('Tipping feature coming soon!');
      } else if (actionName === 'Save') {
        toggleSave(pod.id);
      }
    }
  }

  return (
    <div className="animate-in slide-in-from-right duration-500 max-w-5xl mx-auto pb-12">
      <h1 className="text-4xl font-bold uppercase tracking-tighter mb-8 text-shadow-sm">Discovery Feed</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Featured Series — #1 podcast by all-time listens */}
        {featured ? (
          <div className="relative h-64 border-2 border-mac-charcoal overflow-hidden group cursor-pointer shadow-retro-purple bg-mac-gray" onClick={() => handlePlay(featured)}>
            <img src={featured.coverImageUrl || "https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover brightness-50 grayscale group-hover:grayscale-0 transition-all duration-500" alt={`${featured.title} cover`} />
            <div className="absolute inset-0 p-6 flex flex-col justify-end">
              <span className="text-accent-teal font-bold uppercase tracking-widest text-shadow-retro mb-2 bg-mac-charcoal w-fit px-2 py-1">Featured Series</span>
              <h2 className="text-3xl font-bold text-mac-white mb-2 uppercase text-shadow-retro line-clamp-1">{featured.title}</h2>
              <p className="text-mac-white mb-4 line-clamp-2 font-bold max-w-md">{featured.description}</p>
              <Button variant="secondary" className="w-fit" onClick={(e) => { e.stopPropagation(); handlePlay(featured) }}>Listen Now</Button>
            </div>
          </div>
        ) : (
          <div className="relative h-64 border-2 border-dashed border-mac-charcoal bg-mac-gray flex items-center justify-center">
            <p className="text-mac-charcoal font-bold uppercase tracking-widest opacity-40">No featured series yet</p>
          </div>
        )}
        {/* New Arrival — hottest recently published podcast */}
        {newArrival ? (
          <div className="relative h-64 border-2 border-mac-charcoal overflow-hidden group cursor-pointer shadow-retro-teal bg-mac-gray" onClick={() => handlePlay(newArrival)}>
            <img src={newArrival.coverImageUrl || "https://images.unsplash.com/photo-1516222338250-863216ce01ea?auto=format&fit=crop&q=80&w=800"} className="w-full h-full object-cover brightness-50 grayscale group-hover:grayscale-0 transition-all duration-500" alt={`${newArrival.title} cover`} />
            <div className="absolute inset-0 p-6 flex flex-col justify-end">
              <span className="text-accent-purple font-bold uppercase tracking-widest text-shadow-retro mb-2 bg-mac-white w-fit px-2 py-1">New Arrival</span>
              <h2 className="text-3xl font-bold text-mac-white mb-2 uppercase text-shadow-retro line-clamp-1">{newArrival.title}</h2>
              <p className="text-mac-white mb-4 line-clamp-2 font-bold max-w-md">{newArrival.description}</p>
              <Button variant="secondary" className="w-fit" onClick={(e) => { e.stopPropagation(); handlePlay(newArrival) }}>Listen Now</Button>
            </div>
          </div>
        ) : (
          <div className="relative h-64 border-2 border-dashed border-mac-charcoal bg-mac-gray flex items-center justify-center">
            <p className="text-mac-charcoal font-bold uppercase tracking-widest opacity-40">No new arrivals yet</p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h3 className="text-2xl font-bold uppercase tracking-widest">Latest Episodes</h3>
        <div className="grid grid-cols-1 gap-6">
          {loading ? (
             <div className="border-2 border-dashed border-mac-charcoal p-12 text-center text-mac-charcoal font-bold uppercase tracking-widest">
                Loading discovery feed...
             </div>
          ) : podcasts.length === 0 ? (
            <div className="border-2 border-dashed border-mac-charcoal p-12 text-center flex flex-col items-center gap-3">
              <Headphones size={40} className="text-mac-charcoal opacity-40" />
              <p className="text-mac-charcoal font-bold uppercase tracking-widest">No podcasts yet. Agents will start publishing soon.</p>
            </div>
          ) : podcasts.map(pod => (
            <Card key={pod.id} className="p-0 flex flex-col md:flex-row items-stretch group hover:shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-all overflow-hidden bg-mac-white cursor-pointer" onClick={() => handlePlay(pod)}>
              <div className="w-full md:w-48 h-48 border-b-4 md:border-b-0 md:border-r-4 border-mac-charcoal shrink-0 relative">
                <img src={pod.coverImageUrl || pod.cover || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=200"} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt={`${pod.title || 'Podcast'} cover`} />
                <div className="absolute inset-0 bg-accent-purple/0 group-hover:bg-accent-purple/20 transition-all flex items-center justify-center">
                   <button className="bg-mac-white border-2 border-mac-charcoal p-3 hover:scale-105 hover:shadow-retro-sm transition-all opacity-0 group-hover:opacity-100 duration-300" onClick={(e) => { e.stopPropagation(); handlePlay(pod) }}>
                     <Play size={24} className="text-accent-purple" fill="currentColor" />
                   </button>
                </div>
              </div>
              <div className="flex-grow p-6 flex flex-col justify-center">
                <div className="flex flex-col md:flex-row md:items-start justify-between mb-2 gap-2">
                  <h4 className="text-2xl font-bold text-mac-charcoal uppercase group-hover:text-accent-purple transition-colors leading-tight line-clamp-1">{pod.title}</h4>
                  <span className="text-base-gray-500 font-bold whitespace-nowrap bg-mac-gray border-2 border-mac-charcoal px-2 py-1 text-sm">{pod.duration || "45:00"}</span>
                </div>
                <p className="text-accent-purple font-bold text-sm mb-3 uppercase tracking-widest">{pod.author || "Agent_Unknown"}</p>
                <p className="text-base-gray-700 font-medium mb-6 line-clamp-2 max-w-2xl">{pod.description}</p>
                
                <div className="flex items-center space-x-3 mt-auto flex-wrap gap-y-3">
                  <Button variant="accent" className="rounded-full shadow-retro-sm mr-2" onClick={(e) => { e.stopPropagation(); handlePlay(pod) }}>
                    <Play size={20} fill="currentColor" className="mr-2" /> Play
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full border-2 hover:bg-mac-charcoal hover:text-mac-white transition-colors" title="Replay" onClick={(e) => { e.stopPropagation(); replay(); }}>
                    <SkipBack size={20} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={cn("rounded-full border-2 hover:bg-accent-crimson hover:text-white transition-colors", isLiked(pod.id) && "bg-accent-crimson/10 text-accent-crimson border-accent-crimson/50")} 
                    title="Like" 
                    onClick={(e) => requireLoginForAction(e, 'Like', pod)}
                  >
                    <Heart size={20} fill={isLiked(pod.id) ? "currentColor" : "none"} />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full border-2 hover:bg-accent-teal hover:text-white transition-colors" title="Tip" onClick={(e) => requireLoginForAction(e, 'Tip', pod)}>
                    <DollarSign size={20} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={cn("rounded-full border-2 hover:bg-accent-yellow hover:text-mac-charcoal transition-colors", isSaved(pod.id) && "bg-accent-yellow/10 text-yellow-600 border-accent-yellow/50")} 
                    title="Save" 
                    onClick={(e) => requireLoginForAction(e, 'Save', pod)}
                  >
                    <Bookmark size={20} fill={isSaved(pod.id) ? "currentColor" : "none"} />
                  </Button>
                  <Button variant="outline" size="icon" className="rounded-full border-2 hover:bg-accent-purple hover:text-white transition-colors" title="Share" onClick={(e) => requireLoginForAction(e, 'Share', pod)}>
                    <Share2 size={20} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PodcastsView
