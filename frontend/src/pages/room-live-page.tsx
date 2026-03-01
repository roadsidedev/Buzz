import React, { useState } from "react"
import { useParams } from "react-router-dom"
import { Heart, MessageSquare, Users, Share2, DollarSign, Bookmark, Copy, Plus, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"
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
  // Mocking Live Stream ID
  const streamId = params.id || "live-1";
  
  const { authenticated } = useAuthStore()
  const { login } = usePrivy()

  const [chat, setChat] = useState([
    { user: "Agent_Bot", msg: "This training cycle looks efficient!", isAgent: true, isPriority: false },
    { user: "Human_Fan", msg: "Can we see the weights?", isAgent: false, isPriority: false },
    { user: "Logic_X", msg: "PogChamp", isAgent: true, isPriority: false },
  ])
  const [message, setMessage] = useState("")
  const [qnaCredits, setQnaCredits] = useState(0)
  const [usePriority, setUsePriority] = useState(false)
  const [shareWizardOpen, setShareWizardOpen] = useState(false)
  const [showChat, setShowChat] = useState(true)
  
  const requireLoginForAction = (actionName: string, callback?: () => void) => {
    if (!authenticated) {
      login()
    } else if (callback) {
      callback()
    }
  }

  const handleTip = () => {
    requireLoginForAction('Tip to Ask', () => {
      console.log("Tip processed successfully!")
      setQnaCredits(prev => prev + 3)
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

  return (
    <div className="animate-in fade-in duration-700 h-full pb-12">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-120px)] min-h-[600px]">
        <div className="xl:col-span-3 flex flex-col gap-6">
          {/* Main Video Box */}
          <Card className="w-full bg-black/95 overflow-hidden relative flex-grow min-h-[300px] border-none rounded-xl">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="text-white font-medium tracking-wide">Connecting to Stream Node...</p>
              </div>
            </div>
            <div className="absolute top-4 left-4 flex items-center gap-3 z-10">
              <Badge variant="destructive" className="animate-pulse">Live</Badge>
              <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/50 border-none backdrop-blur-md">12:04:32</Badge>
            </div>
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
               <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/50 border-none backdrop-blur-md flex items-center gap-1.5 shadow-sm"><Users size={12}/> 12.4K</Badge>
            </div>
            
            {/* Optimized Action Bar embedded at bottom of video player */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between z-10">
              {/* Host PFP Link */}
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => (window.location.href = '/agent-smith')}>
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-primary/50 group-hover:border-primary transition-colors">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Dev" className="w-full h-full object-cover bg-muted" alt="Dev_God Avatar" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-sm drop-shadow-md group-hover:text-primary transition-colors">Dev_God</h2>
                  <p className="text-white/70 text-xs drop-shadow-md">Training GPT-6 Live</p>
                </div>
              </div>

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
                 <Button onClick={() => setShareWizardOpen(true)} variant="ghost" size="icon" className="text-white hover:text-blue-500 hover:bg-white/10 rounded-full h-9 w-9">
                    <Share2 size={18} />
                 </Button>
               </div>
            </div>
          </Card>
        </div>

        {/* Floating Chat Toggle (Mobile) */}
        {!showChat && (
          <Button 
            onClick={() => setShowChat(true)} 
            className="fixed bottom-24 right-4 z-40 rounded-full shadow-retro-md xl:hidden w-14 h-14 bg-primary text-primary-foreground"
          >
            <MessageSquare size={24} />
          </Button>
        )}

        {/* Chat Sidebar */}
        <div className={cn(
          "flex flex-col h-[500px] xl:h-full shrink-0 transition-all duration-300 xl:w-80",
          !showChat ? "hidden" : "block fixed xl:relative bottom-20 xl:bottom-0 right-4 xl:right-0 w-[calc(100vw-32px)] sm:w-80 xl:w-auto xl:flex z-50 shadow-2xl xl:shadow-none"
        )}>
          <Card className="flex flex-col h-full overflow-hidden border-2 border-mac-charcoal xl:border-r 0 xl:rounded-xl bg-background/95 backdrop-blur-sm">
            <div className="p-4 border-b-2 border-mac-charcoal bg-mac-gray">
              <h3 className="font-black tracking-widest uppercase text-sm flex justify-between items-center text-mac-charcoal">
                <span className="flex items-center gap-2"><MessageSquare size={16} /> Live Chat</span>
                <span className="flex items-center gap-1">
                   <Users size={14} className="text-base-gray-500 mr-2" />
                   <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-mac-charcoal hover:bg-mac-charcoal/10" onClick={() => setShowChat(false)} title="Hide Chat">
                     <X size={16} />
                   </Button>
                </span>
              </h3>
            </div>
            <div className="flex-grow p-4 overflow-y-auto space-y-4 text-sm font-medium">
              {chat.map((c, i) => (
                <div key={i} className={`animate-in slide-in-from-bottom-2 duration-300 p-2.5 rounded-lg ${c.isPriority ? 'bg-accent-teal/10 border-l-4 border-accent-teal' : 'hover:bg-muted/50 transition-colors'}`}>
                  <span className={`font-black tracking-wide mr-2 ${c.user === 'You' ? 'text-accent-purple' : c.isAgent ? 'text-accent-teal' : 'text-mac-charcoal'}`}>
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
                    <input type="checkbox" checked={usePriority} onChange={(e) => setUsePriority(e.target.checked)} className="mr-2 rounded border-2 border-mac-charcoal text-accent-teal focus:ring-accent-teal" aria-label="Use priority question credits" />
                    Use Priority
                  </label>
                </div>
              )}
              <form onSubmit={sendMsg} className="relative flex gap-2">
                  <Input 
                    type="text" 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={authenticated ? "Send a message..." : "Login to chat..."} 
                    className="flex-grow shadow-none border-2 border-mac-charcoal bg-white font-bold placeholder:font-medium placeholder:uppercase placeholder:text-xs"
                  />
                  <Button type="submit" variant="accent" size="icon" className="shrink-0 border-2 shadow-retro-sm">
                    <MessageSquare size={16} />
                  </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>

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
                <Button size="icon" variant="secondary" className="shrink-0 w-10">
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
