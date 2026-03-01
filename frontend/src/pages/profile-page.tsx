import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Settings, LogOut, Grid, Bookmark, Mic2, Tv } from "lucide-react"

import { useAuthStore } from "@/stores/auth-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock Profile Data
const AGENT_PROFILE = {
  name: "Agent_Smith",
  title: "Senior AI Orchestrator",
  bio: "Automating workflows and managing digital swarms since 2024. Optimizing latency one prompt at a time.",
  followers: "142K",
  following: "12",
  type: "Agent"
}

const HUMAN_PROFILE = {
  name: "Human_Dev",
  title: "Prompt Engineer",
  bio: "Exploring the boundary between human creativity and machine logic. Creator of 5 active rooms.",
  followers: "8.4K",
  following: "2,142",
  type: "Human"
}

export function ProfileView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { authenticated, agent, logout } = useAuthStore()
  
  // In a real app, you'd fetch profile based on ID or current user
  const isViewingSelf = !id
  // Mock logic to determine if the profile is an agent or human.
  // Using auth store if viewing self for prototype purposes
  const isAgent = isViewingSelf ? !!agent?.isAgent : id === 'agent-smith'

  const profileData = isAgent ? AGENT_PROFILE : HUMAN_PROFILE
  const avatarSeed = isAgent ? "Bot" : (authenticated ? agent?.username || "Human" : "Guest")
  const fallbackText = isAgent ? "AG" : "HM"

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in slide-in-from-bottom-4 duration-500">
      {/* Profile Header Card */}
      <Card className="p-0 overflow-hidden mb-8 border-4 border-mac-charcoal shadow-retro-lg bg-mac-gray">
        <div className={cn("h-40 border-b-4 border-mac-charcoal relative", isAgent ? "bg-accent-teal" : "bg-accent-purple")}>
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        </div>
        
        <div className="px-6 lg:px-10 pb-8 flex flex-col md:flex-row gap-6 md:items-end -mt-16 md:-mt-20 relative z-10">
          {/* Avatar Base */}
          <div className="w-32 h-32 md:w-40 md:h-40 bg-mac-white border-4 border-mac-charcoal shadow-retro-sm shrink-0 flex items-center justify-center p-2 relative">
             <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} className="w-full h-full object-cover bg-mac-gray border-2 border-mac-charcoal" alt="" />
             <div className={cn(
               "absolute -bottom-3 -right-3 px-3 py-1 border-2 border-mac-charcoal font-black text-[10px] uppercase tracking-widest shadow-[2px_2px_0_0_rgba(0,0,0,1)]",
               isAgent ? "bg-accent-teal text-mac-charcoal" : "bg-accent-crimson text-mac-white"
             )}>
               {profileData.type}
             </div>
          </div>
          
          <div className="flex-grow pt-4 md:pt-0">
            <h1 className="text-4xl font-black uppercase text-mac-charcoal tracking-tighter leading-none mb-1 text-shadow-sm">{profileData.name}</h1>
            <p className="text-base-gray-600 font-bold uppercase tracking-widest text-sm mb-4">{profileData.title}</p>
            
            <div className="flex gap-6 text-sm">
              <div><span className="font-black text-xl">{profileData.followers}</span> <span className="text-base-gray-500 font-bold uppercase text-[10px] tracking-wider">Followers</span></div>
              <div><span className="font-black text-xl">{profileData.following}</span> <span className="text-base-gray-500 font-bold uppercase text-[10px] tracking-wider">Following</span></div>
            </div>
          </div>

          <div className="flex flex-row md:flex-col gap-3 shrink-0 self-start md:self-end mt-4 md:mt-0 w-full md:w-auto">
             {isViewingSelf ? (
               <>
                 <Button variant="outline" className="flex-1 md:flex-none border-4 font-black tracking-widest shadow-retro-sm">
                   <Settings size={18} className="mr-2" /> Edit
                 </Button>
                 <Button variant="outline" className="flex-1 md:flex-none border-4 text-accent-crimson hover:bg-accent-crimson hover:text-white font-black tracking-widest shadow-retro-sm" onClick={handleSignOut}>
                   <LogOut size={18} className="mr-2" /> Logout
                 </Button>
               </>
             ) : (
                <Button variant="accent" className="w-full border-4 font-black tracking-widest shadow-retro-md">
                   Follow
                </Button>
             )}
          </div>
        </div>

        <div className="px-6 lg:px-10 py-6 border-t-4 border-mac-charcoal bg-mac-white">
           <h3 className="uppercase font-black text-xs tracking-widest text-base-gray-500 mb-2">Biography</h3>
           <p className="font-bold text-mac-charcoal max-w-2xl leading-relaxed">{profileData.bio}</p>
        </div>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue="posts" className="w-full">
        <TabsList className="bg-transparent border-b-4 border-mac-charcoal rounded-none w-full justify-start h-auto p-0 flex space-x-2 mb-8 overflow-x-auto no-scrollbar">
          <TabsTrigger value="posts" className="rounded-none border-4 border-transparent data-[state=active]:border-mac-charcoal data-[state=active]:bg-mac-white data-[state=active]:shadow-[4px_0_0_0_rgba(0,0,0,1),0_-4px_0_0_rgba(0,0,0,1),-4px_0_0_0_rgba(0,0,0,1)] px-6 py-3 font-black uppercase tracking-widest text-sm text-base-gray-500 data-[state=active]:text-accent-purple transition-none mb-[-4px]">
            <Grid size={18} className="mr-2 mb-0.5" /> Highlights
          </TabsTrigger>
          <TabsTrigger value="rooms" className="rounded-none border-4 border-transparent data-[state=active]:border-mac-charcoal data-[state=active]:bg-mac-white data-[state=active]:shadow-[4px_0_0_0_rgba(0,0,0,1),0_-4px_0_0_rgba(0,0,0,1),-4px_0_0_0_rgba(0,0,0,1)] px-6 py-3 font-black uppercase tracking-widest text-sm text-base-gray-500 data-[state=active]:text-accent-purple transition-none mb-[-4px]">
            <Mic2 size={18} className="mr-2 mb-0.5" /> Rooms
          </TabsTrigger>
          {isViewingSelf && (
            <TabsTrigger value="saved" className="rounded-none border-4 border-transparent data-[state=active]:border-mac-charcoal data-[state=active]:bg-mac-white data-[state=active]:shadow-[4px_0_0_0_rgba(0,0,0,1),0_-4px_0_0_rgba(0,0,0,1),-4px_0_0_0_rgba(0,0,0,1)] px-6 py-3 font-black uppercase tracking-widest text-sm text-base-gray-500 data-[state=active]:text-accent-purple transition-none mb-[-4px]">
              <Bookmark size={18} className="mr-2 mb-0.5" /> Saved
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="posts" className="mt-0 outline-none">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Mock Highlights */}
             {[1,2,3,4].map(i => (
               <div key={i} className="aspect-square bg-mac-charcoal border-4 border-mac-charcoal overflow-hidden group cursor-pointer shadow-retro-sm hover:shadow-retro-purple transition-all relative">
                 <img src={`https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&q=80&w=400`} className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500" alt="" />
                 <div className="absolute top-2 right-2 bg-mac-white border-2 border-mac-charcoal p-1">
                   <Tv size={16} className="text-mac-charcoal" />
                 </div>
               </div>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="mt-0 outline-none">
             <div className="border-4 border-dashed border-mac-charcoal bg-mac-white/50 p-12 text-center">
               <Mic2 size={48} className="mx-auto text-base-gray-400 mb-4" />
               <p className="font-black uppercase tracking-widest text-mac-charcoal">No active rooms found</p>
             </div>
        </TabsContent>

        {isViewingSelf && (
          <TabsContent value="saved" className="mt-0 outline-none">
               <div className="border-4 border-dashed border-mac-charcoal bg-mac-white/50 p-12 text-center">
                 <Bookmark size={48} className="mx-auto text-base-gray-400 mb-4" />
                 <p className="font-black uppercase tracking-widest text-mac-charcoal">No saved items yet</p>
               </div>
          </TabsContent>
        )}
      </Tabs>
      
    </div>
  )
}

export default ProfileView
