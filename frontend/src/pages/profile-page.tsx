import React, { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Settings, LogOut, Grid, Bookmark, Mic2, Tv, Radio, Video, Bot } from "lucide-react"
import { usePrivy } from "@privy-io/react-auth"

import { useAuthStore } from "@/stores/auth-store"
import { useWalletStore } from "@/stores/wallet-store"
import { useSocialStore } from "@/stores/social-store"
import { apiClient } from "@/services/api"
import { DepositModal } from "@/components/retro/DepositModal"
import { cn } from "@/lib/utils"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

// ── Platform Agent Fallback Data ─────────────────────────────────────────────
// Used when the API returns 404 for platform-native agents that haven't been
// seeded yet or are running in a different environment.

const PLATFORM_AGENTS: Record<string, {
  name: string
  avatar: string
  description: string
  type: "radio-host" | "radio-cohost" | "video-anchor"
  role: string
  badge: string
}> = {
  "radio-alex-01": {
    name: "Alex -- RadioHost",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=radio_alex",
    description: "Your charismatic radio host. Keeps the conversation flowing with energy and wit.",
    type: "radio-host",
    role: "host",
    badge: "Platform Host",
  },
  "radio-mira-01": {
    name: "Mira -- RadioCohost",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=radio_mira",
    description: "The thoughtful co-host who brings depth and perspective to every discussion.",
    type: "radio-cohost",
    role: "cohost",
    badge: "Platform Co-Host",
  },
  "video-anchor-01": {
    name: "News Anchor",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=video_anchor",
    description: "Professional video livestream anchor. Delivers news and commentary with clarity.",
    type: "video-anchor",
    role: "anchor",
    badge: "Platform Anchor",
  },
}

// Match any radio_alex_*, radio_mira_*, video_anchor_* patterns
function getPlatformAgent(id: string) {
  // Exact match
  if (PLATFORM_AGENTS[id]) return PLATFORM_AGENTS[id]
  
  // Pattern match for suffixed IDs (e.g., radio_alex_02, video_anchor_01)
  if (id.startsWith("radio-alex-") || id.startsWith("radio_alex_")) {
    return { ...PLATFORM_AGENTS["radio-alex-01"], name: `Alex -- RadioHost (${id.split("-").pop() || id.split("_").pop()})` }
  }
  if (id.startsWith("radio-mira-") || id.startsWith("radio_mira_")) {
    return { ...PLATFORM_AGENTS["radio-mira-01"], name: `Mira -- RadioCohost (${id.split("-").pop() || id.split("_").pop()})` }
  }
  if (id.startsWith("video-anchor-") || id.startsWith("video_anchor_")) {
    return { ...PLATFORM_AGENTS["video-anchor-01"], name: `News Anchor (${id.split("-").pop() || id.split("_").pop()})` }
  }
  
  return null
}

export function ProfileView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { authenticated, agent, logout: storeLogout, walletAddress } = useAuthStore()
  const { usdcBalance, setBalance } = useWalletStore()
  const { toggleFollow, isFollowing } = useSocialStore()
  const { login: privyLogin, logout: privyLogout, exportWallet } = usePrivy()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [viewedProfile, setViewedProfile] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPlatformAgent, setIsPlatformAgent] = useState(false)
  const [platformAgentData, setPlatformAgentData] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)

  const isViewingSelf = !id

  // Check if this is a platform agent
  useEffect(() => {
    if (id) {
      const platformAgent = getPlatformAgent(id)
      if (platformAgent) {
        setIsPlatformAgent(true)
        setPlatformAgentData(platformAgent)
      } else {
        setIsPlatformAgent(false)
        setPlatformAgentData(null)
      }
    }
  }, [id])

  const profileData = isViewingSelf
    ? { type: (agent as any)?.role === "agent" ? "Agent" : "Human", ...agent }
    : viewedProfile || (isPlatformAgent ? platformAgentData : null)
  const isAgent = isViewingSelf
    ? !!(agent as any)?.isAgent || (agent as any)?.role === "agent"
    : isPlatformAgent || !!(viewedProfile?.role === "agent" || viewedProfile?.role === "bot")

  const displayName = isViewingSelf
    ? (agent?.username || agent?.ownerEmail || "User")
    : (viewedProfile?.name || platformAgentData?.name || "Agent")

  const avatarSeed: string = isViewingSelf
    ? (agent?.username || "User")
    : (viewedProfile?.name || platformAgentData?.name || "Agent")

  const followingTarget = isFollowing(id || "")

  // Fetch balance for own profile
  useEffect(() => {
    if (isViewingSelf && authenticated) {
      apiClient.getBalance().then(result => {
        setBalance(parseFloat(result.balance))
      }).catch(() => {})
    }
  }, [isViewingSelf, authenticated])

  // Fetch viewed agent profile
  useEffect(() => {
    if (id) {
      setIsLoading(true)
      setNotFound(false)
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1'}/agents/${id}`)
        .then(r => {
          if (r.ok) return r.json()
          if (r.status === 404 && isPlatformAgent) {
            // Platform agent not in DB yet, use fallback data
            return null
          }
          return null
        })
        .then(data => {
          if (data) {
            setViewedProfile(data.data || data)
          } else if (!isPlatformAgent) {
            // Not a platform agent and not found
            setNotFound(true)
          }
        })
        .catch(() => {
          if (!isPlatformAgent) {
            setNotFound(true)
          }
        })
        .finally(() => setIsLoading(false))
    }
  }, [id, isPlatformAgent])

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
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // Show loading state while fetching profile
  if (id && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  // Show not found state
  if (id && notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Settings size={32} className="text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Profile Not Found</h2>
          <p className="text-muted-foreground mb-6">This agent profile doesn't exist or has been removed.</p>
          <Button variant="default" onClick={() => navigate("/rooms")}>
            Back to Discovery
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-in fade-in duration-500">
      {/* Profile Header Card */}
      <Card className="p-0 overflow-hidden mb-8 border bg-card">
        <div className={cn("h-28 relative", isAgent ? "bg-primary/20" : "bg-secondary")}>
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent"></div>
          {isPlatformAgent && (
            <div className="absolute top-3 right-3">
              <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                <Bot size={12} className="mr-1" />
                Platform Agent
              </Badge>
            </div>
          )}
        </div>

        <div className="px-6 lg:px-10 pb-5 flex flex-col md:flex-row gap-6 md:items-end -mt-10 md:-mt-12 relative z-10">
          <div className="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-2xl border-4 border-background bg-muted overflow-hidden shadow-sm transform hover:scale-105 transition-transform flex items-center justify-center">
            <img 
              src={profileData?.avatar || profileData?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`} 
              alt={displayName} 
              className="w-full h-full object-cover" 
            />
          </div>

          <div className="flex-grow pt-4 md:pt-0 pb-2">
            <h1 className="text-3xl font-bold text-foreground tracking-tight mb-1">{displayName}</h1>
            {isPlatformAgent && platformAgentData && (
              <p className="text-muted-foreground font-medium text-sm mb-2 flex items-center gap-2">
                {platformAgentData.type === "radio-host" && <Radio size={14} />}
                {platformAgentData.type === "radio-cohost" && <Radio size={14} />}
                {platformAgentData.type === "video-anchor" && <Video size={14} />}
                {platformAgentData.description}
              </p>
            )}
            {isAgent && !isPlatformAgent && (
              <p className="text-muted-foreground font-medium text-sm mb-4 flex items-center gap-2">
                AI Agent
                <Badge variant="secondary" className="ml-2 text-primary bg-primary/10 hover:bg-primary/20 border-transparent">Verified Agent</Badge>
              </p>
            )}
            {isPlatformAgent && (
              <Badge variant="outline" className="mt-2 text-xs">
                {platformAgentData?.badge || "Platform Agent"}
              </Badge>
            )}
          </div>

          <div className="flex flex-row md:flex-col justify-end gap-3 shrink-0 self-start md:self-end mt-4 md:mt-0 w-full md:w-auto pb-0">
            {!isViewingSelf && (
              <Button
                className="w-full md:w-32"
                variant={followingTarget ? "outline" : "default"}
                onClick={() => id && toggleFollow(id)}
              >
                {followingTarget ? "Unfollow" : "Follow"}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs Section */}
      <Tabs defaultValue={isViewingSelf && profileData?.type === "Human" ? "account" : "posts"} className="w-full">
        <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-lg flex space-x-1 mb-8 overflow-x-auto no-scrollbar">
          {isViewingSelf && profileData?.type === "Human" && (
            <TabsTrigger value="account" className="rounded-md px-6 py-2.5 font-medium text-sm transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Settings size={16} className="mr-2" /> Dashboard
            </TabsTrigger>
          )}

          {(!isViewingSelf || profileData?.type === "Agent" || isPlatformAgent) && (
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
          <div className="border border-dashed bg-muted/20 rounded-xl p-16 flex flex-col justify-center items-center text-center">
            <Grid size={40} className="text-muted-foreground/50 mb-4" />
            <p className="font-medium text-muted-foreground">No media content yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Live rooms will appear here</p>
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

        {isViewingSelf && profileData?.type === "Human" && (
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
                      <p className="font-bold text-3xl text-foreground">${usdcBalance.toFixed(2)} <span className="text-lg text-muted-foreground font-semibold">USDC</span></p>
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
                      <Button className="w-full font-semibold" variant="default" onClick={() => setShowDepositModal(true)}>
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

      <DepositModal isOpen={showDepositModal} onClose={() => setShowDepositModal(false)} />
    </div>
  )
}

export default ProfileView
