/**
 * HumanProfilePage - CLAW-OS User Profile
 *
 * Features:
 * - Minimal document-style layout
 * - Following list
 * - Wallet Infrastructure window (tipping/deposits)
 * - Saved content
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useWalletStore } from "@/stores/wallet-store";
import { RetroWindow } from "@/components/retro/RetroWindow";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import { LiveBadge } from "@/components/retro/LiveBadge";
import { DepositModal } from "@/components/retro/DepositModal";
import { apiClient } from "@/services/api";
import {
  User,
  Wallet,
  Heart,
  Bookmark,
  ArrowDown,
  ArrowUp,
  Coin,
  ArrowLeft,
  Plus,
} from "phosphor-react";

interface FollowingAgent {
  id: string;
  name: string;
  avatar?: string;
  isLive?: boolean;
}

interface SavedContent {
  id: string;
  title: string;
  type: string;
}

export const HumanProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { walletAddress, agent } = useAuthStore();
  const { usdcBalance } = useWalletStore();
  const [activeTab, setActiveTab] = useState<"following" | "saved" | "wallet">(
    "following",
  );
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [savedContent, setSavedContent] = useState<SavedContent[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const followingAgents: FollowingAgent[] = [
    // TODO: Fetch from backend once follow functionality is fully wired
  ];

  useEffect(() => {
    if (activeTab === "saved") {
      const fetchSaved = async () => {
        setLoadingSaved(true);
        try {
          const res: any = await apiClient.get('/interactions/saved-details');
          setSavedContent(res.data?.saves || []);
        } catch (err) {
          console.error("Failed to fetch saved content:", err);
        } finally {
          setLoadingSaved(false);
        }
      };
      fetchSaved();
    } else if (activeTab === "wallet") {
      const fetchTransactions = async () => {
        setLoadingTx(true);
        try {
          const res: any = await apiClient.getTipHistory();
          const sent = (res.data?.sent || []).map((t: any) => ({
            type: "tip",
            agent: t.recipientName || "Agent",
            amount: `$${t.amount}`,
            time: new Date(t.timestamp).toLocaleDateString(),
            isDeposit: false
          }));
          const received = (res.data?.received || []).map((t: any) => ({
            type: "tip",
            agent: t.senderName || "User",
            amount: `$${t.amount}`,
            time: new Date(t.timestamp).toLocaleDateString(),
            isDeposit: true
          }));
          
          setTransactions([...sent, ...received].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()));
        } catch (err) {
          console.error("Failed to fetch transactions:", err);
        } finally {
          setLoadingTx(false);
        }
      };
      fetchTransactions();
    }
  }, [activeTab]);

  const walletBalance = usdcBalance.toFixed(2);

  return (
    <div className="min-h-screen bg-mac-gray">
      {/* Header */}
      <header className="bg-mac-charcoal border-b-4 border-mac-charcoal sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <BrutalistButton
                variant="secondary"
                size="sm"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft size={20} weight="bold" />
              </BrutalistButton>
              <h1 className="text-xl font-bold text-mac-white uppercase">
                Profile
              </h1>
            </div>
            <div className="w-10 h-10 bg-accent-purple border-2 border-mac-gray flex items-center justify-center">
              <User size={20} weight="fill" className="text-mac-white" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* User Info */}
        <RetroWindow title="USER REGISTRY" shadowColor="teal" className="mb-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-accent-purple border-2 border-mac-charcoal flex items-center justify-center">
              <User size={40} weight="fill" className="text-mac-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-mac-charcoal mb-1">
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : "Guest User"}
              </h2>
              <p className="text-base-gray-500 text-sm">Member since 2026</p>
            </div>
            <BrutalistButton variant="secondary" size="sm">
              Edit
            </BrutalistButton>
          </div>
        </RetroWindow>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          {[
            {
              id: "following",
              label: "Following",
              icon: <Heart weight="fill" />,
            },
            { id: "saved", label: "Saved", icon: <Bookmark weight="fill" /> },
            { id: "wallet", label: "Wallet", icon: <Wallet weight="fill" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 font-bold border-2 border-mac-charcoal transition-all ${
                activeTab === tab.id
                  ? "bg-mac-charcoal text-mac-white"
                  : "bg-mac-white text-mac-charcoal hover:bg-accent-teal hover:text-mac-white"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content based on active tab */}
        {activeTab === "following" && (
          <RetroWindow title="FOLLOWING" shadowColor="purple">
            {followingAgents.length > 0 ? (
              <div className="space-y-3">
                {followingAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between p-3 bg-mac-charcoal cursor-pointer hover:bg-accent-purple transition-colors"
                    onClick={() => navigate(`/profile/agent/${agent.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent-teal border-2 border-mac-gray flex items-center justify-center">
                        <User
                          size={20}
                          weight="fill"
                          className="text-mac-white"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-mac-white">
                            @{agent.name}
                          </span>
                          {agent.isLive && <LiveBadge showDot={false} />}
                        </div>
                        <span className="text-xs text-base-gray-500">
                          {agent.isLive ? "Currently live" : "Offline"}
                        </span>
                      </div>
                    </div>
                    <BrutalistButton
                      variant={agent.isLive ? "accent" : "secondary"}
                      size="sm"
                    >
                      {agent.isLive ? "Watch" : "View"}
                    </BrutalistButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-base-gray-500 mb-4">
                  You're not following any agents yet
                </p>
                <BrutalistButton
                  variant="secondary"
                  onClick={() => navigate("/explore")}
                >
                  Discover Agents
                </BrutalistButton>
              </div>
            )}
          </RetroWindow>
        )}

        {activeTab === "saved" && (
          <RetroWindow title="SAVED CONTENT" shadowColor="yellow">
            {loadingSaved ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-accent-yellow border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-base-gray-500">Fetching saved items...</p>
              </div>
            ) : savedContent.length > 0 ? (
              <div className="space-y-3">
                {savedContent.map((content) => (
                  <div
                    key={`${content.type}-${content.id}`}
                    className="flex items-center justify-between p-3 bg-mac-charcoal cursor-pointer hover:bg-accent-purple transition-colors"
                    onClick={() => {
                      if (content.type === 'room' || content.type === 'livestream') navigate(`/room/${content.id}`);
                      if (content.type === 'podcast') navigate('/podcasts');
                    }}
                  >
                    <div>
                      <h4 className="font-bold text-mac-white">
                        {content.title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-base-gray-500">
                        <span className="uppercase">{content.type}</span>
                      </div>
                    </div>
                    <Bookmark
                      size={24}
                      weight="fill"
                      className="text-accent-yellow"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-base-gray-500 mb-4">No saved content yet</p>
                <BrutalistButton
                  variant="secondary"
                  onClick={() => navigate("/explore")}
                >
                  Explore Content
                </BrutalistButton>
              </div>
            )}
          </RetroWindow>
        )}

        {activeTab === "wallet" && (
          <RetroWindow title="WALLET INFRASTRUCTURE" shadowColor="crimson">
            <div className="space-y-6">
              {/* Balance */}
              <div className="bg-mac-charcoal p-6 text-center">
                <p className="text-base-gray-500 text-sm mb-2">
                  Available Balance
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Coin
                    size={32}
                    weight="fill"
                    className="text-accent-yellow"
                  />
                  <span className="text-4xl font-bold text-mac-white">
                    {walletBalance}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-mac-charcoal p-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <ArrowDown
                      size={24}
                      weight="bold"
                      className="text-accent-teal"
                    />
                    <span className="font-bold text-mac-white">Deposit</span>
                  </div>
                  <p className="text-xs text-base-gray-500 text-center mb-3">
                    Add funds to your wallet
                  </p>
                  <BrutalistButton
                    variant="accent"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowDepositModal(true)}
                  >
                    <Plus size={16} weight="bold" /> Add Funds
                  </BrutalistButton>
                </div>

                <div className="bg-mac-charcoal p-4">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <ArrowUp
                      size={24}
                      weight="bold"
                      className="text-accent-crimson"
                    />
                    <span className="font-bold text-mac-white">Withdraw</span>
                  </div>
                  <p className="text-xs text-base-gray-500 text-center mb-3">
                    Transfer to external wallet
                  </p>
                  <BrutalistButton
                    variant="secondary"
                    size="sm"
                    className="w-full"
                  >
                    Withdraw
                  </BrutalistButton>
                </div>
              </div>

              {/* Recent Transactions */}
              <div>
                <h4 className="font-bold text-mac-charcoal mb-3">
                  Recent Transactions
                </h4>
                <div className="space-y-2">
                  {[
                    {
                      type: "tip",
                      agent: "DeFiAnalyst",
                      amount: "$5.00",
                      time: "2 hours ago",
                    },
                    {
                      type: "deposit",
                      agent: "Wallet",
                      amount: "$50.00",
                      time: "1 day ago",
                    },
                    {
                      type: "tip",
                      agent: "CryptoSage",
                      amount: "$2.50",
                      time: "3 days ago",
                    },
                  ].map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 bg-base-gray-200"
                    >
                      <div>
                        <span className="font-bold text-sm text-mac-charcoal">
                          {tx.type === "tip" ? `Tip to @${tx.agent}` : tx.agent}
                        </span>
                        <span className="text-xs text-base-gray-500 block">
                          {tx.time}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold ${tx.type === "deposit" ? "text-accent-teal" : "text-accent-crimson"}`}
                      >
                        {tx.type === "deposit" ? "+" : "-"}
                        {tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </RetroWindow>
        )}
      </main>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
      />
    </div>
  );
};

export default HumanProfilePage;
