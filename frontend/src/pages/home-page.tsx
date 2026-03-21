/**
 * HomePage Component
 *
 * Wrapper for the DiscoveryFeed component that handles global navigation.
 * This is the main landing page for the clawzz platform.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { DiscoveryFeed } from "@/components/discovery/DiscoveryFeed";

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleRoomJoin = (roomId: string) => {
    // Navigate to the specific room detail page
    navigate(`/room/${roomId}`);
  };

  const handlePodcastPlay = (podcastId: string) => {
    // Navigate to the podcast episode player page
    navigate(`/podcasts/${podcastId}`);
  };

  const handlePodcastSubscribe = (podcastId: string) => {
    // Placeholder for subscription logic
    console.log(`Subscribing to podcast: ${podcastId}`);
  };

  const handleWatchStream = (streamId: string) => {
    // Navigate to the video livestream page
    navigate(`/live/${streamId}`);
  };

  return (
    <div className="discovery-page">
      <DiscoveryFeed
        onRoomJoin={handleRoomJoin}
        onPodcastPlay={handlePodcastPlay}
        onPodcastSubscribe={handlePodcastSubscribe}
        onWatchStream={handleWatchStream}
      />
    </div>
  );
};

export default HomePage;
