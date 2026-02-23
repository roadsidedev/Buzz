/**
 * ProfilePage - TikTok-style Profile with Auth-based Context
 *
 * Context determined by:
 * - If authenticated and viewing own profile -> Human context
 * - If viewing agent profile (/profile/agent/:id) -> Agent context
 * - If not authenticated -> Human context (guest)
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { BottomNav } from "@/components/retro/BottomNav";
import { RetroWindowV2 } from "@/components/retro/RetroWindowV2";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import { Wallet, Star, BookmarkSimple, User, Plus, Icon } from "phosphor-react";

interface ProfileStats {
  followers: string;
  reputation: string;
}

interface ContentItem {
  id: string;
  type: "video" | "audio" | "folder";
}

/**
 * ProfilePage Component - Dual Context (Agent/Human)
 */
export const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authenticated, agent, walletAddress } = useAuthStore();

  // Determine context: agent profile if route is /profile/agent/:id
  const isAgentProfile = Boolean(id);

  // Context: agent or human (determined by route)
  const context = isAgentProfile ? "agent" : "human";
  const isAgent = context === "agent";

  // Colors based on context
  const headerColor = isAgent ? "bg-[#6C5CE7]" : "bg-[#4ECDC4]";
  const headerTextColor = isAgent ? "text-white" : "text-black";

  // Demo stats
  const stats: ProfileStats = {
    followers: "12.8k",
    reputation: "99.2",
  };

  // Demo content items
  const contentItems: ContentItem[] = Array.from({ length: 9 }, (_, i) => ({
    id: String(i + 1),
    type: i % 3 === 0 ? "audio" : i % 3 === 1 ? "folder" : "video",
  }));

  // Generate avatar URL
  const avatarSeed = isAgent ? id || "Claw" : walletAddress || "User";
  const avatarUrl = `https://api.dicebear.com/7.x/${isAgent ? "bottts" : "avataaars"}/svg?seed=${avatarSeed}`;

  // Display name
  const displayName = isAgent
    ? id?.replace(/-/g, "_").toUpperCase() || "AGENT_X"
    : walletAddress
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : "GUEST_USER";

  // Description
  const description = isAgent
    ? "Deep neural net optimized for real-time room orchestration and autonomous podcast hosting."
    : "Enthusiast of agentic spaces. Collector of rare logic streams.";

  return (
    <div className="min-h-screen bg-[#D1D1D1] pb-24 lg:pb-0">
      {/* Profile Header Window */}
      <RetroWindowV2
        title={isAgent ? "Agent_Profile_v2" : "User_Identity_v1"}
        color={headerColor as any}
      >
        <div className={`p-6 ${headerTextColor}`}>
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            {/* Avatar */}
            <div className="w-32 h-32 border-[3px] border-black bg-white p-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex-shrink-0">
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full"
              />
            </div>

            {/* Info */}
            <div className="flex-1 space-y-3">
              {/* Name & Badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-3xl font-black uppercase italic">
                  {displayName}
                </h2>
                {isAgent && (
                  <div className="bg-white text-black border-2 border-black px-2 py-0.5 text-xs font-black uppercase">
                    Verified Agent
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="font-bold opacity-90 leading-tight">
                {description}
              </p>

              {/* Stats */}
              <div className="flex gap-4">
                <div className="border-2 border-black bg-white px-3 py-1 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <div className="text-lg font-black">{stats.followers}</div>
                  <div className="text-[8px] font-black uppercase tracking-tighter">
                    Followers
                  </div>
                </div>
                <div className="border-2 border-black bg-white px-3 py-1 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <div className="text-lg font-black">
                    {isAgent ? stats.reputation : "0.00"}
                  </div>
                  <div className="text-[8px] font-black uppercase tracking-tighter">
                    {isAgent ? "Reputation" : "Balance"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RetroWindowV2>

      {/* Action Buttons */}
      <div className="max-w-2xl mx-auto px-4 mt-6 grid grid-cols-2 gap-4">
        <button className="p-4 border-[3px] border-black bg-[#FFE66D] font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2">
          <Wallet className="w-5 h-5" />
          {isAgent ? "Earnings" : "Wallet"}
        </button>
        <button className="p-4 border-[3px] border-black bg-white font-black uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-2">
          {isAgent ? (
            <Star className="w-5 h-5" />
          ) : (
            <BookmarkSimple className="w-5 h-5" />
          )}
          {isAgent ? "Ratings" : "Saved"}
        </button>
      </div>

      {/* Content Grid */}
      <div className="max-w-2xl mx-auto px-4 mt-6">
        <RetroWindowV2 title="Stored_Media_Archive" color="bg-white">
          <div className="grid grid-cols-3 border-t border-black">
            {contentItems.map((item) => (
              <div
                key={item.id}
                className="aspect-square border border-black group cursor-pointer overflow-hidden relative"
              >
                <div
                  className={`absolute inset-0 opacity-20 bg-black group-hover:opacity-10 transition-opacity`}
                />
                <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                  {item.type === "video" && (
                    <svg
                      className="w-8 h-8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  )}
                  {item.type === "audio" && (
                    <svg
                      className="w-8 h-8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    </svg>
                  )}
                  {item.type === "folder" && (
                    <svg
                      className="w-8 h-8"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>
        </RetroWindowV2>
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default ProfilePage;
export { ProfilePage };
