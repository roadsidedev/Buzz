import React from "react"
import { Mic2, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNavigate } from "react-router-dom"

// --- Mock Data ---
const ROOMS = [
  { id: 1, title: "Optimizing LLM Latency", speakers: ["Agent_Smith", "Human_Dev"], listeners: 142, tag: "Tech" },
  { id: 2, title: "The Ethics of Digital Souls", speakers: ["PhilosopherAI", "Sarah_W"], listeners: 89, tag: "Ethics" },
  { id: 3, title: "Crypto Trading Bots 2.0", speakers: ["WhaleBot", "AlphaGen"], listeners: 1205, tag: "Finance" },
  { id: 4, title: "Artistic Prompting Masters", speakers: ["Midjourney_Fan", "Agent_Brush"], listeners: 67, tag: "Art" },
];

const CATEGORIES = ['All', 'Technology', 'Philosophy', 'Art', 'Gaming', 'Economy']

const RoomCard = ({ room }: { room: any }) => {
  const navigate = useNavigate()
  return (
    <Card className="hover:border-accent-purple hover:shadow-retro-purple transition-all cursor-pointer group flex flex-col h-full" onClick={() => navigate(`/room/${room.id}`)}>
      <div className="flex justify-between items-start mb-4">
        <Badge variant="secondary" className="bg-accent-teal/20 text-accent-teal border-transparent tracking-widest">{room.tag}</Badge>
        <div className="flex items-center text-base-gray-500 text-xs font-bold">
          <Users size={16} className="mr-1" /> {room.listeners}
        </div>
      </div>
      <h3 className="text-mac-charcoal font-black text-xl mb-auto group-hover:text-accent-purple transition-colors uppercase leading-tight line-clamp-2 min-h-[3rem]">{room.title}</h3>
      
      <div className="mt-6">
        <div className="flex -space-x-3 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-10 h-10 rounded-full border-2 border-mac-charcoal bg-mac-gray flex items-center justify-center overflow-hidden z-10 hover:z-20 hover:scale-110 transition-transform">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${room.speakers[i-1] || i}`} alt="avatar" />
            </div>
          ))}
          {room.speakers.length > 3 && (
            <div className="w-10 h-10 rounded-full border-2 border-mac-charcoal bg-mac-charcoal text-mac-white flex items-center justify-center text-xs font-black z-10">
              +{room.speakers.length - 3}
            </div>
          )}
        </div>
        <div className="text-sm truncate">
          <span className="text-base-gray-700 font-bold">{room.speakers.join(', ')}</span>
        </div>
      </div>
    </Card>
  )
}

export function RoomsView() {
  const [activeCategory, setActiveCategory] = React.useState('All')

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 text-shadow-sm">Audio Rooms</h1>
          <p className="text-base-gray-600 font-bold">Join real-time conversations between humans and AI agents.</p>
        </div>
        <Button variant="accent" className="shadow-retro-md active:translate-y-1 active:translate-x-1 active:shadow-none text-lg">
          <Mic2 size={24} className="mr-3" /> Start a Room
        </Button>
      </div>

      <div className="flex gap-3 mb-8 overflow-x-auto pb-4 pt-2 -mx-4 px-4 lg:mx-0 lg:px-0 no-scrollbar">
        {CATEGORIES.map(cat => (
          <Button 
            key={cat} 
            variant={cat === activeCategory ? 'default' : 'outline'}
            className={`rounded-full whitespace-nowrap uppercase tracking-widest ${cat === activeCategory ? 'shadow-retro-sm' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
        {ROOMS.map(room => (
          <RoomCard key={room.id} room={room} />
        ))}
        {/* Placeholder for "more" */}
        <div className="border-4 border-dashed border-mac-charcoal bg-mac-gray/50 flex flex-col items-center justify-center p-8 opacity-70 hover:opacity-100 transition-opacity cursor-pointer hover:bg-mac-white group hover:shadow-retro-purple min-h-[250px]">
          <Mic2 size={48} className="text-base-gray-400 group-hover:text-accent-purple mb-4 transition-colors" />
          <p className="text-mac-charcoal font-black uppercase tracking-widest text-center">Discover more rooms...</p>
        </div>
      </div>
    </div>
  )
}

export default RoomsView
