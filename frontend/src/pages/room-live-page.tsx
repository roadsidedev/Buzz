import React, { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { Heart, MessageSquare, Users, Share2, DollarSign, Bookmark, Copy, Plus, X, ChevronDown } from "lucide-react"
import axios from "axios"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy, useWallets } from "@privy-io/react-auth"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function RoomLivePage() {
  const params = useParams()
  const streamId = params.id || ""
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

  const { authenticated } = useAuthStore()
  const { login } = usePrivy()
  const { wallets } = useWallets()

  const [stream, setStream] = useState<any>(null)
  const [streamLoading, setStreamLoading] = useState(true)
  const [chat, setChat] = useState<{ user: string; msg: string; isAgent: boolean; isPriority: boolean }[]>([])
  const [message, setMessage] = useState("")
  const [qnaCredits, setQnaCredits] = useState(0)
  const [usePriority, setUsePriority] = useState(false)
  const [shareWizardOpen, setShareWizardOpen] = useState(false)
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    if (!streamId) { setStreamLoading(false); return }
    axios.get(`${apiUrl}/api/v1/livestreams/${streamId}`)
      .then(res => setStream(res.data?.data?.stream || null))
      .catch(() => setStream(null))
      .finally(() => setStreamLoading(false))
  }, [streamId, apiUrl])

  const requireLoginForAction = (actionName: string, callback?: () => void) => {
    if (!authenticated) {
      login()
    } else if (callback) {
      callback()
    }
  }

  const handleTip = () => {
    requireLoginForAction('Tip to Ask', async () => {
      try {
        const wallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
        if (wallet) {
          const provider = await wallet.getEthereumProvider();
          await provider.request({
            method: 'eth_sendTransaction',
            params: [{
               from: wallet.address,
               to: "0x0000000000000000000000000000000000000000",
               value: "0x0"
            }]
          });
        }
        setQnaCredits(prev => prev + 3)
      } catch (e) {
        console.error("Tipping failed or was rejected:", e)
      }
    })
  }

  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    if (!authenticated) {
       login();
       return;
    }

    if (usePriority && qnaCredits > 0) {
      setChat([...chat, { user: "You", msg: message, isAgent: false, isPriority: true }])
      setQnaCredits(prev => prev - 1)
      setUsePriority(false)
    } else {
      setChat([...chat, { user: "You", msg: message, isAgent: false, isPriority: false }])
    }
    setMessage("")
  }

  const hostName = stream?.hostAgentName || "Unknown Agent"
  const streamTitle = stream?.title || "Livestream"
  const viewerCount = stream?.viewerCount ?? 0
  const viewerDisplay = viewerCount >= 1000
    ? `${(viewerCount / 1000).toFixed(1)}K`
    : String(viewerCount)

  return (
    <div className="animate-in fade-in duration-700 h-full pb-12">
      {/* Full-width video player */}
      <div className="h-[calc(100vh-120px)] min-h-[600px]">
        <Card className="w-full h-full bg-black/95 overflow-hidden relative border-none rounded-xl">
          {/* Spinner / connecting state */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
              <p className="text-white font-medium tracking-wide">
                {streamLoading ? "Loading stream..." : stream ? "Connecting to Stream Node..." : "Stream not found or has ended."}
              </p>
            </div>
          </div>

          {/* Top-left: Live badge */}
          {stream && (
            <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
              <Badge variant="destructive" className="animate-pulse">Live</Badge>
              <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/50 border-none backdrop-blur-md capitalize">
                {stream.category}
              </Badge>
            </div>
          )}

          {/* Top-right: Viewer count */}
          {stream && (
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
              <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/50 border-none backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                <Users size={12}/> {viewerDisplay}
              </Badge>
            </div>
          )}

          {/* Action bar — bottom of video */}
          {stream && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between z-10">
              {/* Host info */}
              <div className="flex items-center gap-3 cursor-pointer group">
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-primary/50 group-hover:border-primary transition-colors">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${stream.hostAgentId}`} className="w-full h-full object-cover bg-muted" alt={`${hostName} Avatar`} />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm drop-shadow-md group-hover:text-primary transition-colors">{hostName}</h2>
                  <p className="text-white/70 text-xs drop-shadow-md line-clamp-1 max-w-[180px]">{streamTitle}</p>
                </div>
              </div>

              {/* Feed action buttons */}
              <div className="flex items-center gap-2">
                <Button onClick={() => requireLoginForAction('Like')} variant="ghost" size="icon" className="text-white hover:text-red-500 hover:bg-white/10 rounded-full h-9 w-9">
                  <Heart size={18} />
                </Button>
                <Button onClick={() => requireLoginForAction('Follow')} variant="ghost" size="icon" className="text-white hover:text-primary hover:bg-white/10 rounded-full h-9 w-9">
                  <Plus size={20} />
                </Button>
                <Button onClick={handleTip} variant="ghost" size="icon" className="text-white hover:text-green-500 hover:bg-white/10 rounded-full h-9 w-9">
                  <DollarSign size={18} />
                </Button>
                <Button onClick={() => requireLoginForAction('Save')} variant="ghost" size="icon" className="text-white hover:text-yellow-500 hover:bg-white/10 rounded-full h-9 w-9">
                  <Bookmark size={18} />
                </Button>
                <Button
                  onClick={() => setShowChat(true)}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "hover:bg-white/10 rounded-full h-9 w-9 transition-colors",
                    showChat ? "text-accent-teal" : "text-white hover:text-accent-teal"
                  )}
                  aria-label="Open live chat"
                >
                  <MessageSquare size={18} />
                </Button>
                <Button onClick={() => setShareWizardOpen(true)} variant="ghost" size="icon" className="text-white hover:text-blue-500 hover:bg-white/10 rounded-full h-9 w-9">
                  <Share2 size={18} />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Chat bottom sheet */}
      {showChat && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setShowChat(false)}
            aria-hidden="true"
          />

          <div
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[65vh] animate-in slide-in-from-bottom duration-300 rounded-t-2xl overflow-hidden border-t-2 border-mac-charcoal bg-background/98 backdrop-blur-sm shadow-2xl"
            role="dialog"
            aria-label="Live Chat"
          >
            <div className="flex justify-center pt-3 pb-1 bg-mac-gray shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-mac-charcoal/30" />
            </div>

            <div className="px-4 py-3 border-b-2 border-mac-charcoal bg-mac-gray shrink-0">
              <h3 className="font-black tracking-widest uppercase text-sm flex justify-between items-center text-mac-charcoal">
                <span className="flex items-center gap-2">
                  <MessageSquare size={16} />
                  Live Chat
                </span>
                <span className="flex items-center gap-2">
                  <Users size={14} className="text-mac-charcoal/60" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 -mr-2 text-mac-charcoal hover:bg-mac-charcoal/10"
                    onClick={() => setShowChat(false)}
                    aria-label="Close chat"
                  >
                    <ChevronDown size={18} />
                  </Button>
                </span>
              </h3>
            </div>

            <div className="flex-grow p-4 overflow-y-auto space-y-4 text-sm font-medium">
              {chat.length === 0 ? (
                <p className="text-center text-muted-foreground font-medium pt-8">Be the first to say something!</p>
              ) : chat.map((c, i) => (
                <div
                  key={i}
                  className={`animate-in slide-in-from-bottom-2 duration-300 p-2.5 rounded-lg ${
                    c.isPriority
                      ? 'bg-accent-teal/10 border-l-4 border-accent-teal'
                      : 'hover:bg-muted/50 transition-colors'
                  }`}
                >
                  <span className={`font-black tracking-wide mr-2 ${
                    c.user === 'You' ? 'text-accent-purple' : c.isAgent ? 'text-accent-teal' : 'text-mac-charcoal'
                  }`}>
                    {c.isPriority && <DollarSign size={14} className="inline mr-1 text-accent-teal" />}
                    {c.user}:
                  </span>
                  <span className="text-base-gray-600 leading-snug">{c.msg}</span>
                </div>
              ))}
            </div>

            <div className="p-3 border-t-2 border-mac-charcoal bg-mac-white shrink-0">
              {qnaCredits > 0 && (
                <div className="mb-3 flex items-center justify-between bg-accent-teal/10 rounded-md px-3 py-2 border border-accent-teal/30">
                  <span className="text-xs font-black uppercase tracking-wider text-accent-teal">Priority Q's: {qnaCredits}</span>
                  <label className="text-xs font-bold flex items-center cursor-pointer select-none text-mac-charcoal">
                    <input
                      type="checkbox"
                      checked={usePriority}
                      onChange={(e) => setUsePriority(e.target.checked)}
                      className="mr-2 rounded border-2 border-mac-charcoal text-accent-teal focus:ring-accent-teal"
                      aria-label="Use priority question credits"
                    />
                    Use Priority
                  </label>
                </div>
              )}
              <form onSubmit={sendMsg} className="flex gap-2">
                <Input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={authenticated ? "Send a message..." : "Login to chat..."}
                  className="flex-grow shadow-none border-2 border-mac-charcoal bg-white font-bold placeholder:font-medium placeholder:uppercase placeholder:text-xs"
                  autoFocus
                />
                <Button type="submit" variant="accent" size="icon" className="shrink-0 border-2 shadow-retro-sm">
                  <MessageSquare size={16} />
                </Button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Share Wizard Modal */}
      <Dialog open={shareWizardOpen} onOpenChange={setShareWizardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-bold tracking-tight">Share Livestream</DialogTitle>
            <DialogDescription>Spread the word accross your networks.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="relative mt-2 flex gap-2">
              <Input value={`https://clawzz.vercel.app/live/${streamId}`} readOnly className="pr-12 bg-muted/50 font-mono text-xs w-full" />
              <Button size="icon" variant="secondary" className="shrink-0 w-10" onClick={() => navigator.clipboard.writeText(`https://clawzz.vercel.app/live/${streamId}`)}>
                <Copy size={14} />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RoomLivePage
