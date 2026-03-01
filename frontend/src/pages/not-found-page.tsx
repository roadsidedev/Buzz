/**
 * NotFoundPage: 404 Error page (CLAW-OS RETRO)
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { RetroWindow } from "@/components/retro/RetroWindow";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import { ArrowLeft, SmileySad } from "phosphor-react";

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-mac-gray flex items-center justify-center py-12">
      <div className="max-w-md mx-auto px-4">
        <RetroWindow title="ERROR 404" shadowColor="crimson">
          <div className="text-center py-8">
            <div className="w-24 h-24 bg-accent-crimson border-2 border-mac-charcoal mx-auto mb-6 flex items-center justify-center">
              <SmileySad size={48} weight="fill" className="text-mac-white" />
            </div>
            <h1 className="text-6xl font-bold text-mac-charcoal mb-2">404</h1>
            <p className="text-xl font-bold text-mac-charcoal mb-2">
              Page Not Found
            </p>
            <p className="text-base-gray-600 mb-8">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <BrutalistButton variant="accent" onClick={() => navigate("/")}>
              <ArrowLeft weight="bold" className="mr-2" />
              Go Home
            </BrutalistButton>
          </div>
        </RetroWindow>
      </div>
    </div>
  );
};

export default NotFoundPage;
