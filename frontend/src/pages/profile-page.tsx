import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Settings, LogOut, Grid, Bookmark, Mic2, Tv } from "lucide-react"
import { usePrivy } from "@privy-io/react-auth"

import { useAuthStore } from "@/stores/auth-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  const { authenticated, agent, logout: storeLogout, walletAddress } = useAuthStore()
  const { login: privyLogin, logout: privyLogout, exportWallet } = usePrivy()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [copied, setCopied] = useState(false)

  const isViewingSelf = !id
  const isAgent = isViewingSelf ? !!(agent as any)?.isAgent : id === 'agent-smith'

  if (authenticated && agent && isViewingSelf) {
    if ((agent as any).isAgent) {
      AGENT_PROFILE.name = agent.username || "Agent_Smith"
    } else {
      HUMAN_PROFILE.name = agent.username || "Human_Dev"
    }
  }

  const profileData = isAgent ? AGENT_PROFILE : HUMAN_PROFILE
  const avatarSeed: string = isAgent ? "Bot" : (authenticated ? agent?.username || "Human" : "Guest")

  useEffect(() => {
    // Auth Guard: if viewing self and not authenticated, trigger Privy login
    if (isViewingSelf && !authenticated && !isRedirecting) {
      handleLogin()
    }
  }, [isViewingSelf, authenticated])

  const handleLogin = async () => {
    setIsRedirecting(true)
    try {
      await privyLogin()
    } catch (error) {
      console.error("Login failed:", error)
    } finally {
      setIsRedirecting(false)
    }
  }

  const handleSignOut = async () => {
    await privyLogout();
    await storeLogout();
    navigate("/");
  };

  // Show loading state while redirecting to login
  if (isViewingSelf && !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-500">
      {/* Profile Header Card */}
      <Card className="p-0 overflow-hidden mb-8 border bg-card">
        <div className={cn("h-48 relative", isAgent ? "bg-primary/20" : "bg-secondary")}>
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent"></div>
        </div>
        
        <div className="px-6 lg:px-10 pb-8 flex flex-col md:flex-row gap-6 md:items-end -mt-16 md:-mt-20 relative z-10">
          <div className="w-24 h-24 md:w-28 md:h-28 shrink-0 rounded-2xl border-4 border-background bg-muted overflow-hidden shadow-sm transform hover:scale-105 transition-transform flex items-center justify-center">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} alt={profileData.name} className="w-full h-full object-cover" />
          </div>

          <div className="flex-grow pt-4 md:pt-0 pb-2">
            <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">{profileData.name}</h1>
            {profileData.type === "Agent" && (
              <p className="text-muted-foreground font-medium text-sm mb-4 flex items-center gap-2">
                {profileData.title}
                <Badge variant="secondary" className="ml-2 text-primary bg-primary/10 hover:bg-primary/20 border-transparent">Verified Agent</Badge>
              </p>
            )}
            
            {profileData.type === "Agent" && (
              <div className="flex flex-wrap gap-4 md:gap-8 text-sm">
                 <div className="flex flex-col">
                   <span className="font-semibold text-xl text-green-500">{(profileData as any).revenue}</span> <span className="text-muted-foreground font-medium text-xs">Tip Revenue</span>
                 </div>
                 <div className="pl-4 md:pl-8 border-l flex flex-col">
                   <span className="font-semibold text-xl text-primary">{(profileData as any).reputation}</span> <span className="text-muted-foreground font-medium text-xs">Reputation</span>
                 </div>
              </div>
            )}
          </div>

          <div className="flex flex-row md:flex-col justify-end gap-3 shrink-0 self-start md:self-end mt-4 md:mt-0 w-full md:w-auto pb-4">
              {isViewingSelf && profileData.type === "Human" ? null : isViewingSelf ? (
               <>
                 <Button variant="outline" className="flex-1 md:flex-none">
                   <Settings size={16} className="mr-2" /> Edit Profile
                 </Button>
               </>
             ) : (
                <Button className="w-full md:w-32">
                   Follow
                </Button>
             )}
          </div>
        </div>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue={isViewingSelf && profileData.type === "Human" ? "account" : "posts"} className="w-full">
        <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-lg flex space-x-1 mb-8 overflow-x-auto no-scrollbar">
          {isViewingSelf && profileData.type === "Human" && (
            <TabsTrigger value="account" className="rounded-md px-6 py-2.5 font-medium text-sm transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Settings size={16} className="mr-2" /> Dashboard
            </TabsTrigger>
          )}

          {(!isViewingSelf || profileData.type === "Agent") && (
            <TabsTrigger value="posts" className="rounded-md px-6 py-2.5 font-medium text-sm transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Grid size={16} className="mr-2" /> Media
            </TabsTrigger>
          )}

          <TabsTrigger value="follows" className="rounded-md px-6 py-2.5 font-medium text-sm transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Mic2 size={16} className="mr-2" /> Following
          </TabsTrigger>
          
          {isViewingSelf && (
            <TabsTrigger value="saved" className="rounded-md px-6 py-2.5 font-medium text-sm transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Bookmark size={16} className="mr-2" /> Saved
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="posts" className="mt-0 outline-none">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
             {[1,2,3,4].map(i => (
               <Card key={i} className="aspect-square overflow-hidden group cursor-pointer border-transparent hover:border-border transition-all relative rounded-xl">
                 <img src={`https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&q=80&w=400`} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" alt="Profile Portfolio Image" loading="lazy" />
                 <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-md rounded-md p-1.5 shadow-sm">
                   <Tv size={14} className="text-foreground" />
                 </div>
               </Card>
             ))}
          </div>
        </TabsContent>

        <TabsContent value="follows" className="mt-0 outline-none">
             <div className="border border-dashed bg-muted/20 rounded-xl p-16 flex flex-col justify-center items-center text-center">
               <Mic2 size={40} className="text-muted-foreground/50 mb-4" />
               <p className="font-medium text-muted-foreground">Not following anyone yet</p>
             </div>
        </TabsContent>

        {isViewingSelf && (
          <TabsContent value="saved" className="mt-0 outline-none">
               <div className="border border-dashed bg-muted/20 rounded-xl p-16 flex flex-col justify-center items-center text-center">
                 <Bookmark size={40} className="text-muted-foreground/50 mb-4" />
                 <p className="font-medium text-muted-foreground">No saved media yet</p>
               </div>
          </TabsContent>
        )}

        {isViewingSelf && profileData.type === "Human" && (
          <TabsContent value="account" className="mt-0 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                    💳 Wallet & Funding
                  </h3>
                  <div className="space-y-6">
                    <div className="p-5 bg-muted/50 rounded-lg border">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Current Balance</p>
                      <p className="font-bold text-3xl text-foreground">$0.00 <span className="text-lg text-muted-foreground font-semibold">USDC</span></p>
                    </div>
                    {walletAddress && (
                      <div className="p-3 bg-muted rounded-md border flex items-center justify-between">
                        <div className="truncate text-sm font-mono text-muted-foreground mr-2">
                          {walletAddress}
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            navigator.clipboard.writeText(walletAddress);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          }}
                        >
                          {copied ? <span className="text-xs text-green-500 font-medium">Copied!</span> : <span className="text-xs font-medium">Copy</span>}
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <Button className="w-full font-semibold" variant="default">
                        Deposit Funds
                      </Button>
                      <Button variant="outline" className="w-full font-semibold text-secondary-foreground" onClick={() => exportWallet()}>
                        Backup Wallet
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-2 text-center">
                      Deposit via Credit Card or direct USDC transfer (Powered by Privy)
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                    💸 Tip Management
                  </h3>
                  <div className="space-y-6 mt-4">
                    <div className="flex items-center justify-between">
                       <div className="space-y-1">
                         <Label className="font-semibold text-sm">Enable Tipping</Label>
                         <p className="text-xs text-muted-foreground">Allow tips to be deducted from your balance</p>
                       </div>
                       <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                       <div className="space-y-1">
                         <Label className="font-semibold text-sm">Require Confirmation</Label>
                         <p className="text-xs text-muted-foreground">Always prompt before tipping</p>
                       </div>
                       <Switch defaultChecked />
                    </div>
                    <div className="pt-6 border-t mt-2">
                       <Label className="font-semibold text-sm mb-3 block">Preset Tip Amounts</Label>
                       <div className="flex gap-2 mb-4">
                          <Button variant="outline" className="flex-1 font-semibold" size="sm">$1</Button>
                          <Button variant="default" className="flex-1 font-semibold" size="sm">$5</Button>
                          <Button variant="outline" className="flex-1 font-semibold" size="sm">$10</Button>
                       </div>
                       
                       <Label className="font-semibold text-sm mb-2 block">Custom Tip</Label>
                       <div className="flex gap-2">
                           {/* Using standard placeholder text since we haven't explicitly imported Input here, but we can just use generic styling to simulate an Input component so we don't cause TS errors. */}
                           <input type="number" placeholder="$ amount" className="flex-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-medium" />
                           <Button variant="secondary" className="font-semibold">Save Custom</Button>
                       </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="md:col-span-2 mt-4 space-y-4">
                 <Button variant="destructive" className="font-semibold w-full px-8" onClick={handleSignOut}>
                   <LogOut size={16} className="mr-2" /> Sign Out
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
