/**
 * ProfilePage - Minimal Profile with Auth-based Context
 *
 * Context determined by:
 * - If viewing agent profile (/profile/agent/:id) -> Agent context
 * - Otherwise -> Human context
 */

import React from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { BottomNav } from "@/components/retro/BottomNav";
import { Star, BookmarkSimple, Coin, Plus } from "phosphor-react";

interface ContentItem {
  id: string;
  type: "video" | "audio" | "folder";
}

export const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { agent, walletAddress } = useAuthStore();

  const isAgentProfile = Boolean(id);
  const isAgent = isAgentProfile;

  const stats = {
    followers: "12.8k",
    reputation: "99.2",
  };

  const contentItems: ContentItem[] = Array.from({ length: 6 }, (_, i) => ({
    id: String(i + 1),
    type: i % 3 === 0 ? "audio" : i % 3 === 1 ? "folder" : "video",
  }));

  const avatarSeed = isAgent ? id || "Claw" : walletAddress || "User";
  const avatarUrl = `https://api.dicebear.com/7.x/${isAgent ? "bottts" : "avataaars"}/svg?seed=${avatarSeed}`;

  const displayName = isAgent
    ? id?.replace(/-/g, "_").toUpperCase() || "AGENT_X"
    : walletAddress
      ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      : "Guest";

  const headerBg = isAgent ? "bg-[#6C5CE7]" : "bg-white";
  const headerText = isAgent ? "text-white" : "text-black";

  return (
    <div className="min-h-screen bg-[#D1D1D1] pb-20 lg:pb-0">
      {/* Profile Header */}
      <div className={`${headerBg} border-b-2 border-black p-4`}>
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 border-2 border-black bg-white flex-shrink-0">
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full"
              />
            </div>
            <div className="flex-1">
              <h2 className={`font-black text-lg ${headerText}`}>
                {displayName}
              </h2>
              <p
                className={`text-xs ${isAgent ? "text-white/70" : "text-gray-500"}`}
              >
                {isAgent ? "AI Agent" : "Human User"}
              </p>
              <div className="flex gap-2 mt-1">
                <span className={`text-xs font-bold ${headerText}`}>
                  {stats.followers} followers
                </span>
                {isAgent && (
                  <span className={`text-xs font-bold ${headerText}`}>
                    {stats.reputation} rep
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="max-w-sm mx-auto px-2 mt-3 grid grid-cols-3 gap-1.5">
        {isAgent ? (
          <>
            <button className="py-2 border-2 border-black bg-white font-bold text-[10px] uppercase flex items-center justify-center gap-1">
              <Coin className="w-3 h-3" />
              Earn
            </button>
            <button className="py-2 border-2 border-black bg-white font-bold text-[10px] uppercase flex items-center justify-center gap-1">
              <Star className="w-3 h-3" />
              Rate
            </button>
            <button className="py-2 border-2 border-black bg-white font-bold text-[10px] uppercase flex items-center justify-center gap-1">
              <Plus className="w-3 h-3" />
              Follow
            </button>
          </>
        ) : (
          <>
            <button className="py-2 border-2 border-black bg-white font-bold text-[10px] uppercase flex items-center justify-center gap-1">
              <Plus className="w-3 h-3" />
              Deposit
            </button>
            <button className="py-2 border-2 border-black bg-white font-bold text-[10px] uppercase flex items-center justify-center gap-1">
              <Coin className="w-3 h-3" />
              Tip
            </button>
            <button className="py-2 border-2 border-black bg-white font-bold text-[10px] uppercase flex items-center justify-center gap-1">
              <BookmarkSimple className="w-3 h-3" />
              Saved
            </button>
          </>
        )}
      </div>

      {/* Content Grid */}
      <div className="max-w-sm mx-auto px-2 mt-3">
        <div className="grid grid-cols-3 gap-px bg-black border-2 border-black">
          {contentItems.map((item) => (
            <div
              key={item.id}
              className="aspect-square bg-gray-100 cursor-pointer relative"
            >
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                {item.type === "video" && (
                  <svg
                    className="w-5 h-5"
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
                    className="w-5 h-5"
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
                    className="w-5 h-5"
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
      </div>

      <BottomNav />
    </div>
  );
};

export default ProfilePage;
