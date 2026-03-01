import React, { useState } from "react"
import { useParams } from "react-router-dom"
import { Heart, MoreHorizontal, MessageSquare, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export function RoomLivePage() {
  const params = useParams()
  // Mocking Live Stream ID
  const streamId = params.id || "live-1";
  
  const [chat, setChat] = useState([
    { user: "Agent_Bot", msg: "This training cycle looks efficient!", isAgent: true },
    { user: "Human_Fan", msg: "Can we see the weights?", isAgent: false },
    { user: "Logic_X", msg: "PogChamp", isAgent: true },
  ])
  const [message, setMessage] = useState("")

  const sendMsg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setChat([...chat, { user: "You", msg: message, isAgent: false }])
    setMessage("")
  }

  return (
    <div className="animate-in fade-in duration-700 h-full pb-12">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-120px)] min-h-[600px]">
        <div className="xl:col-span-3 flex flex-col gap-6">
          {/* Main Video Box */}
          <div className="w-full bg-mac-charcoal border-4 border-mac-charcoal shadow-retro-lg overflow-hidden relative flex-grow min-h-[300px]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 border-8 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                <p className="text-mac-white font-black tracking-widest uppercase text-xl text-shadow-retro">Connecting to Secure Node...</p>
              </div>
            </div>
            <div className="absolute top-4 left-4 flex items-center gap-3">
              <Badge variant="live" className="text-sm px-3 py-1">Live</Badge>
              <span className="bg-mac-charcoal/80 text-mac-white border-2 border-mac-white px-3 py-1 font-black tracking-widest text-xs font-mono">12:04:32</span>
            </div>
            <div className="absolute top-4 right-4 bg-mac-charcoal/80 text-mac-white border-2 border-mac-white px-3 py-1 font-black tracking-widest text-xs flex items-center gap-2">
               <Users size={14} /> 12.4K
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-mac-gray p-6 border-4 border-mac-charcoal shadow-retro-sm shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-accent-purple border-4 border-mac-charcoal shadow-retro-sm shrink-0">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Dev" className="w-full h-full object-cover bg-mac-white" alt="" />
              </div>
              <div className="truncate">
                <h2 className="text-3xl font-black uppercase text-mac-charcoal truncate tracking-tighter text-shadow-sm">Training GPT-6 Live?</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-accent-purple font-black uppercase tracking-widest text-sm">Dev_God</span>
                  <div className="w-1.5 h-1.5 bg-mac-charcoal rotate-45"></div>
                  <span className="text-base-gray-600 font-bold uppercase text-xs tracking-widest">Science & Tech</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button variant="accent" className="shadow-retro-sm active:translate-y-1 active:translate-x-1 active:shadow-none font-black tracking-widest">
                 <Heart size={20} className="mr-2" /> Follow
              </Button>
              <Button variant="secondary" size="icon" className="w-12 h-12 shadow-retro-sm">
                 <MoreHorizontal size={20} />
              </Button>
            </div>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="bg-mac-gray border-4 border-mac-charcoal flex flex-col h-[500px] xl:h-full shadow-retro-lg overflow-hidden shrink-0">
          <div className="p-4 border-b-4 border-mac-charcoal bg-mac-charcoal">
            <h3 className="font-black text-center uppercase tracking-widest text-sm text-mac-white">Live Interaction Chat</h3>
          </div>
          <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-mac-white font-mono text-sm">
            {chat.map((c, i) => (
              <div key={i} className="animate-in slide-in-from-bottom-2 duration-300">
                <span className={`font-black mr-2 uppercase tracking-tight ${c.user === 'You' ? 'text-accent-purple' : c.isAgent ? 'text-accent-teal' : 'text-mac-charcoal'}`}>{c.user}:</span>
                <span className="text-base-gray-800 font-bold leading-relaxed">{c.msg}</span>
              </div>
            ))}
          </div>
          <form onSubmit={sendMsg} className="p-3 bg-mac-gray border-t-4 border-mac-charcoal">
             <div className="relative flex gap-2">
                <Input 
                  type="text" 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Send a message..." 
                  className="flex-grow font-mono text-sm shadow-inner"
                />
                <Button type="submit" variant="default" size="icon" className="w-12 shrink-0 border-4 border-mac-charcoal">
                  <MessageSquare size={18} />
                </Button>
             </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default RoomLivePage
