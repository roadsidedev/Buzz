import React, { useState } from "react"
import { useParams } from "react-router-dom"
import { Heart, MessageSquare, Users, Share2, DollarSign, Bookmark, Copy } from "lucide-react"
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
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <Badge variant="destructive" className="animate-pulse">Live</Badge>
              <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/50 border-none backdrop-blur-md">12:04:32</Badge>
            </div>
            <div className="absolute top-4 right-4 relative">
               <Badge variant="secondary" className="bg-black/50 text-white hover:bg-black/50 border-none backdrop-blur-md flex items-center gap-1.5"><Users size={12}/> 12.4K</Badge>
            </div>
          </Card>

          <Card className="flex flex-col md:flex-row md:items-start justify-between gap-4 p-6 shrink-0 shadow-sm">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border relative">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Dev" className="w-full h-full object-cover bg-muted" alt="Dev_God Avatar" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-background"></div>
              </div>
              <div className="truncate mb-1">
                <h2 className="text-2xl font-semibold text-foreground truncate tracking-tight mb-1">Training GPT-6 Live?</h2>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-medium text-sm">Dev_God</span>
                  <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
                  <span className="text-muted-foreground text-sm font-medium">Science & Tech</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap mt-2 md:mt-0">
              <Button onClick={() => requireLoginForAction('Like')} variant="default" className="font-semibold shadow-sm">
                 <Heart size={16} className="mr-2" /> Follow
              </Button>
               <Button onClick={handleTip} variant="outline" size="icon" className="hover:text-green-500 transition-colors shadow-sm" title="Tip to Ask Questions">
                 <DollarSign size={18} />
              </Button>
              <Button onClick={() => setShareWizardOpen(true)} variant="outline" size="icon" className="shadow-sm" title="Share Stream">
                 <Share2 size={18} />
              </Button>
               <Button onClick={() => requireLoginForAction('Save')} variant="outline" size="icon" className="hover:text-yellow-500 transition-colors shadow-sm" title="Save">
                 <Bookmark size={18} />
              </Button>
            </div>
          </Card>
        </div>

        {/* Chat Sidebar */}
        <Card className="flex flex-col h-[500px] xl:h-full overflow-hidden shrink-0 shadow-sm border-r-0 xl:border-r border-t-0 xl:border-t rounded-none xl:rounded-xl">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold text-sm text-foreground flex justify-between items-center">
              <span>Live Chat</span>
              <Users size={14} className="text-muted-foreground mr-1" />
            </h3>
          </div>
          <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-background text-sm">
            {chat.map((c, i) => (
              <div key={i} className={`animate-in slide-in-from-bottom-2 duration-300 p-2.5 rounded-lg ${c.isPriority ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-muted/50 transition-colors'}`}>
                <span className={`font-semibold mr-2 ${c.user === 'You' ? 'text-primary' : c.isAgent ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                  {c.isPriority && <DollarSign size={14} className="inline mr-1 text-primary" />}
                  {c.user}:
                </span>
                <span className="text-muted-foreground font-medium">{c.msg}</span>
              </div>
            ))}
          </div>
          
          <div className="p-3 border-t bg-muted/10 shrink-0">
             {qnaCredits > 0 && (
               <div className="mb-3 flex items-center justify-between bg-primary/10 rounded-md px-3 py-2 border border-primary/20">
                 <span className="text-xs font-semibold text-primary">Priority Questions: {qnaCredits}</span>
                 <label className="text-xs font-medium flex items-center cursor-pointer select-none">
                   <input type="checkbox" checked={usePriority} onChange={(e) => setUsePriority(e.target.checked)} className="mr-2 rounded text-primary focus:ring-primary" aria-label="Use priority question credits" />
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
                  className="flex-grow shadow-none"
                />
                <Button type="submit" variant="secondary" size="icon" className="shrink-0 group">
                  <MessageSquare size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                </Button>
             </form>
          </div>
        </Card>
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
