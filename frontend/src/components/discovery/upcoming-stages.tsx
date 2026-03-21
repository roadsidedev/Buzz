import React, { useState, useEffect } from "react";
import { Calendar, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import axios from "axios";
import { useAuthStore } from "@/stores/auth-store";
import { usePrivy } from "@privy-io/react-auth";

export function UpcomingStages() {
  const [upcomingRooms, setUpcomingRooms] = useState<any[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const { walletAddress } = useAuthStore();
  const { login } = usePrivy();
  const apiUrl = (import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1").replace(/\/+$/, "");

  useEffect(() => {
    const fetchUpcomingRooms = async () => {
      setLoadingUpcoming(true);
      try {
        const res = await axios.get(`${apiUrl}/discover/upcoming`, { withCredentials: true });
        if (res.data.success) {
          setUpcomingRooms(res.data.data.rooms);
        }
      } catch (err) {
        console.error("Failed to fetch upcoming rooms:", err);
      } finally {
        setLoadingUpcoming(false);
      }
    };
    fetchUpcomingRooms();
  }, [apiUrl]);

  if (loadingUpcoming) return null;

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-foreground flex items-center">
          <Calendar className="mr-2 text-accent-purple" size={24} /> 
          Upcoming Spaces
        </h2>
      </div>
      {upcomingRooms.length > 0 ? (
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 md:scrollbar-default snap-x">
          {upcomingRooms.map((room) => (
            <div key={room.id} className="min-w-[280px] md:min-w-[320px] snap-center">
               <Card className="hover:border-primary/50 transition-all group flex flex-col h-full overflow-hidden border-2 bg-card text-card-foreground">
                 <div className="p-4 flex-grow flex flex-col">
                   <div className="flex justify-between items-start mb-3">
                     <Badge variant="secondary" className="bg-primary/10 text-primary border border-transparent uppercase font-black text-[10px] tracking-widest">
                       {room.type}
                     </Badge>
                     <div className="text-xs font-black uppercase text-accent-purple border border-accent-purple/30 px-2 py-1 rounded">
                       {new Date(room.scheduledFor!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </div>
                   </div>
                   <h3 className="text-foreground font-black text-lg mb-3 leading-tight line-clamp-2 min-h-[2.5rem] uppercase tracking-tighter">{room.objective}</h3>
                   
                   <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                     <div className="text-xs font-black text-muted-foreground uppercase opacity-80">
                       {new Date(room.scheduledFor!).toLocaleDateString()}
                     </div>
                     <button 
                       className="flex items-center gap-1 text-xs font-bold uppercase bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded transition-colors"
                       onClick={async () => {
                         if (!walletAddress) {
                           alert("Please sign in to receive notifications.");
                           login();
                           return;
                         }
                         try {
                           await axios.post(`${apiUrl}/rooms/${room.id}/notify`, { userId: walletAddress }, { withCredentials: true });
                           alert("You'll be notified when this room starts!");
                         } catch (err) {
                           console.error(err);
                           alert("Failed to subscribe to notifications.");
                         }
                       }}
                     >
                       <Bell size={14} /> Notify Me
                     </button>
                   </div>
                 </div>
               </Card>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border p-8 md:p-12 text-center bg-card rounded-lg flex flex-col items-center gap-4">
           <Calendar size={32} className="text-muted-foreground opacity-40" />
           <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">No spaces scheduled currently</p>
        </div>
      )}
    </div>
  );
}
