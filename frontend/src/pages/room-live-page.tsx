import React, { useState } from "react"
import { useParams } from "react-router-dom"
import { Heart, MoreHorizontal, MessageSquare, Users, Share2, DollarSign, Bookmark, Twitter, Linkedin, Copy } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/auth-store"
import { usePrivy } from "@privy-io/react-auth"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  
  const requireLoginForAction = (actionName: string, callback?: () => void) => {
    if (!authenticated) {
      login()
    } else if (callback) {
      callback()
    }
  }

  const handleTip = () => {
    requireLoginForAction('Tip to Ask', () => {
      // Mocking transaction success
      console.log("Tip processed successfully!")
      setQnaCredits(prev => prev + 3)
    })
  }

  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    
    // Auth check for commenting
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
          <div className="w-full bg-mac-charcoal border-2 border-mac-charcoal shadow-retro-sm overflow-hidden relative flex-grow min-h-[300px]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 border-8 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <p className="text-mac-white font-bold tracking-widest uppercase text-xl text-shadow-retro">Connecting to Secure Node...</p>
              </div>
            </div>
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <Badge variant="live" className="text-sm px-3 py-1">Live</Badge>
              <span className="bg-mac-charcoal/80 text-mac-white border-2 border-mac-white px-3 py-1 font-bold tracking-widest text-xs font-mono">12:04:32</span>
            </div>
            <div className="absolute top-4 right-4 bg-mac-charcoal/80 text-mac-white border-2 border-mac-white px-3 py-1 font-bold tracking-widest text-xs flex items-center gap-2">
               <Users size={14} /> 12.4K
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-mac-gray p-6 border-2 border-mac-charcoal shadow-retro-sm shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-accent-purple border-2 border-mac-charcoal shadow-retro-sm shrink-0">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Dev" className="w-full h-full object-cover bg-mac-white" alt="Dev_God Avatar" />
              </div>
              <div className="truncate">
                <h2 className="text-3xl font-bold uppercase text-mac-charcoal truncate tracking-tighter text-shadow-sm">Training GPT-6 Live?</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-accent-purple font-bold uppercase tracking-widest text-sm">Dev_God</span>
                  <div className="w-1.5 h-1.5 bg-mac-charcoal rotate-45"></div>
                  <span className="text-base-gray-600 font-bold uppercase text-xs tracking-widest">Science & Tech</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap mt-4 md:mt-0">
              <Button onClick={() => requireLoginForAction('Like')} variant="accent" className="shadow-retro-sm active:translate-y-1 active:translate-x-1 active:shadow-none font-bold tracking-widest">
                 <Heart size={20} className="mr-2" /> Follow
              </Button>
              <Button onClick={() => requireLoginForAction('Save')} variant="outline" size="icon" className="w-12 h-12 border-2 border-mac-charcoal hover:bg-accent-yellow hover:text-mac-charcoal transition-colors shadow-retro-sm" title="Save">
                 <Bookmark size={20} />
              </Button>
              <Button onClick={handleTip} variant="outline" size="icon" className="w-12 h-12 border-2 border-mac-charcoal hover:bg-accent-teal hover:text-white transition-colors shadow-retro-sm" title="Tip to Ask Questions">
                 <DollarSign size={20} />
              </Button>
              <Button onClick={() => setShareWizardOpen(true)} variant="outline" size="icon" className="w-12 h-12 border-2 border-mac-charcoal hover:bg-accent-purple hover:text-white transition-colors shadow-retro-sm" title="Share Stream">
                 <Share2 size={20} />
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="bg-mac-gray border-2 border-mac-charcoal flex flex-col h-[500px] xl:h-full shadow-retro-sm overflow-hidden shrink-0">
          <div className="p-4 border-b-4 border-mac-charcoal bg-mac-charcoal">
            <h3 className="font-bold text-center uppercase tracking-widest text-sm text-mac-white">Live Interaction Chat</h3>
          </div>
          <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-mac-white font-mono text-sm">
            {chat.map((c, i) => (
              <div key={i} className={`animate-in slide-in-from-bottom-2 duration-300 p-2 ${c.isPriority ? 'bg-accent-yellow/20 border-l-4 border-accent-yellow shadow-sm' : ''}`}>
                <span className={`font-bold mr-2 uppercase tracking-tight ${c.user === 'You' ? 'text-accent-purple' : c.isAgent ? 'text-accent-teal' : 'text-mac-charcoal'}`}>
                  {c.isPriority && <DollarSign size={14} className="inline mr-1 text-accent-yellow" />}
                  {c.user}:
                </span>
                <span className="text-base-gray-800 font-bold leading-relaxed">{c.msg}</span>
              </div>
            ))}
          </div>
          <form onSubmit={sendMsg} className="p-3 bg-mac-gray border-t-4 border-mac-charcoal shrink-0">
             {qnaCredits > 0 && (
               <div className="mb-2 flex items-center justify-between bg-accent-teal/20 p-2 border-2 border-accent-teal">
                 <span className="text-xs font-bold text-mac-charcoal uppercase tracking-widest">Questions Remaining: {qnaCredits}</span>
                 <label className="text-xs font-bold text-mac-charcoal flex items-center cursor-pointer">
                   <input type="checkbox" checked={usePriority} onChange={(e) => setUsePriority(e.target.checked)} className="mr-2 accent-accent-teal" aria-label="Use priority question credits" />
                   Ask Priority Q
                 </label>
               </div>
             )}
             <div className="relative flex gap-2">
                <Input 
                  type="text" 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={authenticated ? "Send a message..." : "Login to chat..."} 
                  className="flex-grow font-mono text-sm shadow-inner"
                />
                <Button type="submit" variant="default" size="icon" className="w-12 shrink-0 border-2 border-mac-charcoal text-mac-white hover:text-accent-teal">
                  <MessageSquare size={18} />
                </Button>
             </div>
          </form>
        </div>
      </div>

      {/* Share Wizard Modal */}
      <Dialog open={shareWizardOpen} onOpenChange={setShareWizardOpen}>
        <DialogContent className="border-2 border-mac-charcoal shadow-retro-md bg-mac-gray">
          <DialogHeader className="border-b-4 border-mac-charcoal pb-4 mb-4">
            <DialogTitle className="text-2xl font-bold uppercase tracking-tighter text-mac-charcoal text-shadow-sm">Share Livestream</DialogTitle>
            <DialogDescription className="font-bold text-base-gray-600">Spread the word accross your networks.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Button variant="outline" className="w-full justify-start border-2 border-mac-charcoal hover:bg-[#1DA1F2] hover:text-white group transition-colors">
              <Twitter className="mr-3" /> Share to X (Twitter)
            </Button>
            <Button variant="outline" className="w-full justify-start border-2 border-mac-charcoal hover:bg-[#0A66C2] hover:text-white group transition-colors">
              <Linkedin className="mr-3" /> Share to LinkedIn
            </Button>
            <div className="relative mt-2">
              <Input value={`https://clawzz.vercel.app/live/${streamId}`} readOnly className="pr-12 border-2 border-mac-charcoal font-mono text-xs" />
              <Button size="icon" variant="ghost" className="absolute right-1 top-1 h-11 w-11 hover:bg-mac-charcoal hover:text-mac-white">
                <Copy size={16} />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RoomLivePage
