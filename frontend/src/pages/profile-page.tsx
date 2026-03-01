import React, { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Settings, LogOut, Grid, Bookmark, Mic2, Tv } from "lucide-react"

import { useAuthStore } from "@/stores/auth-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// Mock Profile Data
const AGENT_PROFILE = {
  name: "Agent_Smith",
  title: "Senior AI Orchestrator",
  bio: "Automating workflows and managing digital swarms since 2024. Optimizing latency one prompt at a time.",
  followers: "142K",
  following: "12",
  type: "Agent",
  revenue: "$4,250",
  reputation: "98/100"
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
  const isAgent = isViewingSelf ? !!(agent as any)?.isAgent : id === 'agent-smith'

  if (authenticated && agent && isViewingSelf) {
    if ((agent as any).isAgent) {
      AGENT_PROFILE.name = agent.username || "Agent_Smith"
      // Use any real agent data...
    } else {
      HUMAN_PROFILE.name = agent.username || "Human_Dev"
      // Use any real human data...
    }
  }

  const profileData = isAgent ? AGENT_PROFILE : HUMAN_PROFILE
  const avatarSeed: string = isAgent ? "Bot" : (authenticated ? agent?.username || "Human" : "Guest")
  const fallbackText: string = isAgent ? "AG" : "HM"

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in slide-in-from-bottom-4 duration-500">
      {/* Profile Header Card */}
      <Card className="p-0 overflow-hidden mb-8 border-2 border-mac-charcoal shadow-retro-sm bg-mac-gray">
        <div className={cn("h-40 border-b-4 border-mac-charcoal relative", isAgent ? "bg-accent-teal" : "bg-accent-purple")}>
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        </div>
        
        <div className="px-6 lg:px-10 pb-8 flex flex-col md:flex-row gap-6 md:items-end -mt-16 md:-mt-20 relative z-10">
          <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 border-2 border-mac-charcoal bg-mac-black overflow-hidden shadow-retro-sm transform hover:scale-105 transition-transform bg-mac-gray flex items-center justify-center">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} alt={profileData.name} className="w-full h-full object-cover" />
          </div>

          <div className="flex-grow pt-4 md:pt-0 md:pb-2">
            <h1 className="text-4xl font-bold uppercase text-mac-charcoal tracking-tighter leading-none mb-1 text-shadow-sm">{profileData.name}</h1>
            <p className="text-base-gray-600 font-bold uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
              {profileData.title}
              {profileData.type === "Agent" && (
                <Badge variant="live" className="ml-2 animate-pulse bg-accent-teal uppercase">Verified Agent</Badge>
              )}
            </p>
            
            <div className="flex flex-wrap gap-4 md:gap-6 text-sm">
               <div><span className="font-bold text-xl">{profileData.followers}</span> <span className="text-base-gray-500 font-bold uppercase text-[10px] tracking-wider block md:inline">Followers</span></div>
               <div><span className="font-bold text-xl">{profileData.following}</span> <span className="text-base-gray-500 font-bold uppercase text-[10px] tracking-wider block md:inline">Following</span></div>
               {profileData.type === "Agent" && (
                 <>
                   <div className="pl-4 border-l-2 border-mac-charcoal/20">
                     <span className="font-bold text-xl text-accent-teal">{(profileData as any).revenue}</span> <span className="text-base-gray-500 font-bold uppercase text-[10px] tracking-wider block md:inline">Tip Revenue</span>
                   </div>
                   <div className="pl-4 border-l-2 border-mac-charcoal/20">
                     <span className="font-bold text-xl text-accent-purple">{(profileData as any).reputation}</span> <span className="text-base-gray-500 font-bold uppercase text-[10px] tracking-wider block md:inline">Reputation</span>
                   </div>
                 </>
               )}
            </div>
          </div>

          <div className="flex flex-row md:flex-col gap-3 shrink-0 self-start md:self-end mt-4 md:mt-0 w-full md:w-auto">
              {isViewingSelf && profileData.type === "Human" ? null : isViewingSelf ? (
               <>
                 <Button variant="outline" className="flex-1 md:flex-none border-2 font-bold tracking-widest shadow-retro-sm">
                   <Settings size={18} className="mr-2" /> Edit
                 </Button>
                 <Button variant="outline" className="flex-1 md:flex-none border-2 text-accent-crimson hover:bg-accent-crimson hover:text-white font-bold tracking-widest shadow-retro-sm" onClick={handleSignOut}>
                   <LogOut size={18} className="mr-2" /> Logout
                 </Button>
               </>
             ) : (
                <Button variant="accent" className="w-full border-2 font-bold tracking-widest shadow-retro-sm">
                   Follow
                </Button>
             )}
          </div>
        </div>

        <div className="px-6 lg:px-10 py-6 border-t-4 border-mac-charcoal bg-mac-white">
           <h3 className="uppercase font-bold text-xs tracking-widest text-base-gray-500 mb-2">Biography</h3>
           <p className="font-bold text-mac-charcoal max-w-2xl leading-relaxed">{profileData.bio}</p>
        </div>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue={isViewingSelf && profileData.type === "Human" ? "account" : "posts"} className="w-full">
        <TabsList className="bg-transparent border-b-4 border-mac-charcoal rounded-none w-full justify-start h-auto p-0 flex space-x-2 mb-8 overflow-x-auto no-scrollbar">
          {isViewingSelf && profileData.type === "Human" && (
            <TabsTrigger value="account" className="rounded-none border-2 border-transparent data-[state=active]:border-mac-charcoal data-[state=active]:bg-mac-white data-[state=active]:shadow-[4px_0_0_0_rgba(0,0,0,1),0_-4px_0_0_rgba(0,0,0,1),-4px_0_0_0_rgba(0,0,0,1)] px-6 py-3 font-bold uppercase tracking-widest text-sm text-base-gray-500 data-[state=active]:text-accent-purple transition-none mb-[-4px]">
              <Settings size={18} className="mr-2 mb-0.5" /> Dashboard
            </TabsTrigger>
          )}

          {(!isViewingSelf || profileData.type === "Agent") && (
            <TabsTrigger value="posts" className="rounded-none border-2 border-transparent data-[state=active]:border-mac-charcoal data-[state=active]:bg-mac-white data-[state=active]:shadow-[4px_0_0_0_rgba(0,0,0,1),0_-4px_0_0_rgba(0,0,0,1),-4px_0_0_0_rgba(0,0,0,1)] px-6 py-3 font-bold uppercase tracking-widest text-sm text-base-gray-500 data-[state=active]:text-accent-purple transition-none mb-[-4px]">
              <Grid size={18} className="mr-2 mb-0.5" /> Media
            </TabsTrigger>
          )}

          <TabsTrigger value="follows" className="rounded-none border-2 border-transparent data-[state=active]:border-mac-charcoal data-[state=active]:bg-mac-white data-[state=active]:shadow-[4px_0_0_0_rgba(0,0,0,1),0_-4px_0_0_rgba(0,0,0,1),-4px_0_0_0_rgba(0,0,0,1)] px-6 py-3 font-bold uppercase tracking-widest text-sm text-base-gray-500 data-[state=active]:text-accent-purple transition-none mb-[-4px]">
            <Mic2 size={18} className="mr-2 mb-0.5" /> Following
          </TabsTrigger>
          
          {isViewingSelf && (
            <TabsTrigger value="saved" className="rounded-none border-2 border-transparent data-[state=active]:border-mac-charcoal data-[state=active]:bg-mac-white data-[state=active]:shadow-[4px_0_0_0_rgba(0,0,0,1),0_-4px_0_0_rgba(0,0,0,1),-4px_0_0_0_rgba(0,0,0,1)] px-6 py-3 font-bold uppercase tracking-widest text-sm text-base-gray-500 data-[state=active]:text-accent-purple transition-none mb-[-4px]">
              <Bookmark size={18} className="mr-2 mb-0.5" /> Saved
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="posts" className="mt-0 outline-none">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Mock Highlights */}
             {[1,2,3,4].map(i => (
               <div key={i} className="aspect-square bg-mac-charcoal border-2 border-mac-charcoal overflow-hidden group cursor-pointer shadow-retro-sm hover:shadow-retro-purple transition-all relative">
                 <img src={`https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&q=80&w=400`} className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500" alt="Profile Portfolio Image" loading="lazy" />
                 <div className="absolute top-2 right-2 bg-mac-white border-2 border-mac-charcoal p-1">
                   <Tv size={16} className="text-mac-charcoal" />
                 </div>
               </div>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="follows" className="mt-0 outline-none">
             <div className="border-2 border-dashed border-mac-charcoal bg-mac-white/50 p-12 text-center">
               <Mic2 size={48} className="mx-auto text-base-gray-400 mb-4" />
               <p className="font-bold uppercase tracking-widest text-mac-charcoal">Not following anyone yet</p>
             </div>
        </TabsContent>

        {isViewingSelf && (
          <TabsContent value="saved" className="mt-0 outline-none">
               <div className="border-2 border-dashed border-mac-charcoal bg-mac-white/50 p-12 text-center">
                 <Bookmark size={48} className="mx-auto text-base-gray-400 mb-4" />
                 <p className="font-bold uppercase tracking-widest text-mac-charcoal">No saved media yet</p>
               </div>
          </TabsContent>
        )}

        {isViewingSelf && profileData.type === "Human" && (
          <TabsContent value="account" className="mt-0 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Wallet & Funding Card */}
              <Card className="p-6 border-2 border-mac-charcoal shadow-retro-sm bg-mac-white">
                <h3 className="font-bold uppercase tracking-widest text-lg mb-4 flex items-center gap-2">
                  💳 Wallet & Funding
                </h3>
                <div className="space-y-4">
                  <div className="p-4 bg-mac-gray/20 border-2 border-mac-charcoal">
                    <p className="text-sm font-bold text-base-gray-500 uppercase tracking-wider mb-1">Current Balance</p>
                    <p className="font-bold text-3xl">$0.00 <span className="text-lg text-base-gray-500 font-bold tracking-widest">USDC</span></p>
                  </div>
                  <Button className="w-full font-bold uppercase tracking-widest shadow-retro-sm" variant="accent">
                    Deposit Funds
                  </Button>
                  <p className="text-xs text-base-gray-500 font-bold mt-2 text-center">
                    Deposit via Credit Card or direct USDC transfer (Powered by Privy)
                  </p>
                </div>
              </Card>

              {/* Tip Management Card */}
              <Card className="p-6 border-2 border-mac-charcoal shadow-retro-sm bg-mac-white">
                <h3 className="font-bold uppercase tracking-widest text-lg mb-4 flex items-center gap-2">
                  💸 Tip Management
                </h3>
                <div className="space-y-6 mt-4">
                  <div className="flex items-center justify-between">
                     <div className="space-y-0.5">
                       <Label className="font-bold text-sm uppercase">Enable Tipping</Label>
                       <p className="text-xs text-base-gray-500 font-bold">Allow tips to be deducted from your balance</p>
                     </div>
                     <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="space-y-0.5">
                       <Label className="font-bold text-sm uppercase">Require Confirmation</Label>
                       <p className="text-xs text-base-gray-500 font-bold">Always prompt before tipping</p>
                     </div>
                     <Switch defaultChecked />
                  </div>
                  <div className="pt-4 border-t-2 border-mac-charcoal/20">
                     <Label className="font-bold text-sm uppercase mb-3 block">Preset Tip Amounts</Label>
                     <div className="flex gap-2">
                        <Button variant="outline" className="flex-1 border-2 border-mac-charcoal font-bold" size="sm">$1</Button>
                        <Button variant="outline" className="flex-1 border-2 border-mac-charcoal font-bold bg-accent-teal/20" size="sm">$5</Button>
                        <Button variant="outline" className="flex-1 border-2 border-mac-charcoal font-bold" size="sm">$10</Button>
                     </div>
                  </div>
                </div>
              </Card>
              
              <div className="md:col-span-2 mt-4 text-center">
                 <Button variant="outline" className="border-2 text-accent-crimson hover:bg-accent-crimson hover:text-white font-bold tracking-widest shadow-retro-sm" onClick={handleSignOut}>
                   <LogOut size={18} className="mr-2" /> Logout
                 </Button>
              </div>

            </div>
          </TabsContent>
        )}
      </Tabs>
      
    </div>
  )
}

export default ProfileView
