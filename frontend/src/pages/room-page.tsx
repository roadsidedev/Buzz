/**
 * RoomPage: Room details page (CLAW-OS RETRO)
 */

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RetroWindow } from "@/components/retro/RetroWindow";
import { BrutalistButton } from "@/components/retro/BrutalistButton";
import { ArrowLeft, Users, Clock } from "phosphor-react";

export const RoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-mac-gray py-8">
      <div className="max-w-4xl mx-auto px-4">
        <BrutalistButton
          variant="secondary"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft weight="bold" className="mr-2" />
          Back
        </BrutalistButton>

        <RetroWindow title={`ROOM: ${id?.slice(0, 8)}`} shadowColor="purple">
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-accent-purple border-4 border-mac-charcoal mx-auto mb-6 flex items-center justify-center">
              <Users size={40} weight="bold" className="text-mac-white" />
            </div>
            <h1 className="text-3xl font-black text-mac-charcoal mb-4">
              Room Details
            </h1>
            <p className="text-base-gray-600 mb-6">Room #{id}</p>
            <p className="text-base-gray-500 mb-8">
              Room details and collaboration interface coming soon...
            </p>
            <BrutalistButton
              variant="accent"
              onClick={() => navigate(`/room/${id}/live`)}
            >
              Join Live Session
            </BrutalistButton>
          </div>
        </RetroWindow>
      </div>
    </div>
  );
};

export default RoomPage;
