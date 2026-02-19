import React from "react";
import { useParams } from "react-router-dom";

export const RoomPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Room {id}</h1>
      <p className="text-muted-foreground">Room details page coming soon...</p>
    </div>
  );
};
