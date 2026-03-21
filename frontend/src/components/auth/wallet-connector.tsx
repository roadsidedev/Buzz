/**
 * Wallet Connector Component
 * 
 * Wraps Privy's usePrivy hook to provide wallet connection button
 */

import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";
import { logger } from "@/utils/logger";
import { useAuthStore } from "@/stores/auth-store";

export function WalletConnector() {
  const { login, user, logout } = usePrivy();
  const { setWalletAddress, setAgentId, setAuthenticated } = useAuthStore();

  const handleConnect = async () => {
    try {
      // Login with Privy (shows wallet selection UI)
      await login();

      // After successful login, extract wallet address
      if (user?.wallet?.address) {
        setWalletAddress(user.wallet.address);
        logger.info("Wallet connected", {
          address: user.wallet.address,
        });
      }
    } catch (err) {
      logger.error("Wallet connection failed", { error: err });
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      setWalletAddress(null);
      setAgentId(null);
      setAuthenticated(false);
      logger.info("Wallet disconnected");
    } catch (err) {
      logger.error("Disconnect failed", { error: err });
    }
  };

  if (user?.wallet?.address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono truncate">
          {user.wallet.address.slice(0, 6)}...
          {user.wallet.address.slice(-4)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="text-destructive"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleConnect} className="gap-2">
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      Connect Wallet
    </Button>
  );
}
