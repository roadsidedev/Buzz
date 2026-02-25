import React from "react";
import { useNavigate } from "react-router-dom";
import { clsx } from "clsx";

export type MediaType = "podcast" | "livestream" | "room";

interface MediaSkeletonProps {
  type: MediaType;
  id?: string;
  className?: string;
  showActions?: boolean;
  title?: string;
  agentName?: string;
  viewerCount?: number;
  category?: string;
  isLive?: boolean;
}

const SkeletonPulse = ({ className }: { className?: string }) => (
  <div className={clsx("animate-pulse bg-gray-300", className)} />
);

const ActionButtonSkeleton = () => (
  <div className="w-10 h-10 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
    <SkeletonPulse className="w-4 h-4" />
  </div>
);

export const MediaSkeleton: React.FC<MediaSkeletonProps> = ({
  type,
  id,
  className,
  showActions = true,
  title,
  agentName,
  viewerCount,
  category,
  isLive,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!id) return;

    if (type === "livestream") {
      navigate(`/room/${id}/live`);
    } else if (type === "podcast") {
      navigate(`/episode/${id}`);
    } else {
      navigate(`/room/${id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={clsx(
        "relative bg-slate-200 border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
        "aspect-[4/5] sm:aspect-video lg:aspect-square",
        id ? "cursor-pointer hover:translate-y-1 transition-transform" : "",
        className,
      )}
    >
      {/* Scanline effect overlay */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)] pointer-events-none z-10" />

      {/* Type-specific media area */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        {type === "podcast" && (
          <div className="flex items-center gap-4 sm:gap-8">
            <SkeletonPulse className="w-16 h-16 sm:w-24 sm:h-24 rounded-lg" />
            <div className="hidden sm:flex flex-col gap-3">
              <SkeletonPulse className="w-40 h-6 rounded" />
              <SkeletonPulse className="w-32 h-4 rounded" />
              <SkeletonPulse className="w-36 h-4 rounded" />
            </div>
          </div>
        )}

        {type === "livestream" && (
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <div className="relative">
              <SkeletonPulse className="w-16 h-16 sm:w-20 sm:h-20 rounded-full" />
              <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full animate-pulse" />
            </div>
            <SkeletonPulse className="w-32 sm:w-48 h-5 rounded" />
            <div className="flex gap-2">
              <SkeletonPulse className="w-12 sm:w-16 h-6 rounded" />
              <SkeletonPulse className="w-14 sm:w-20 h-6 rounded" />
            </div>
          </div>
        )}

        {type === "room" && (
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <SkeletonPulse className="w-14 h-14 sm:w-18 sm:h-18 rounded-lg" />
            <SkeletonPulse className="w-32 sm:w-40 h-6 rounded" />
            <div className="flex gap-2">
              <SkeletonPulse className="w-10 sm:w-12 h-7 sm:h-8 rounded" />
              <SkeletonPulse className="w-10 sm:w-12 h-7 sm:h-8 rounded" />
              <SkeletonPulse className="w-10 sm:w-12 h-7 sm:h-8 rounded" />
            </div>
          </div>
        )}
      </div>

      {/* LIVE badge for livestream */}
      {type === "livestream" && (
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-red-500 border-2 border-black px-2 py-0.5">
          <SkeletonPulse className="w-6 sm:w-8 h-2.5 sm:h-3" />
        </div>
      )}

      {/* Category badge */}
      <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-black text-white border-2 border-white px-2 py-0.5">
        <SkeletonPulse className="w-10 sm:w-12 h-2.5 sm:h-3" />
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="absolute right-2 sm:right-3 bottom-20 sm:bottom-24 flex flex-col gap-2 sm:gap-3">
          {type === "podcast" ? (
            <>
              <ActionButtonSkeleton />
              <ActionButtonSkeleton />
              <ActionButtonSkeleton />
            </>
          ) : (
            <>
              <ActionButtonSkeleton />
              <ActionButtonSkeleton />
              <ActionButtonSkeleton />
              <ActionButtonSkeleton />
              <ActionButtonSkeleton />
              <ActionButtonSkeleton />
            </>
          )}
        </div>
      )}

      {/* Bottom info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-white/90">
        <div className="flex items-center gap-2 mb-2">
          <SkeletonPulse className="w-5 h-5 sm:w-6 sm:h-6 rounded-sm" />
          <SkeletonPulse className="w-16 sm:w-20 h-2.5 sm:h-3 rounded" />
        </div>
        <SkeletonPulse className="w-full h-4 sm:h-5 rounded mb-2" />
        <div className="flex gap-2">
          <SkeletonPulse className="w-10 sm:w-12 h-4 sm:h-5 rounded" />
          <SkeletonPulse className="w-12 sm:w-14 h-4 sm:h-5 rounded" />
        </div>
      </div>
    </div>
  );
};

interface FeedSkeletonProps {
  count?: number;
  className?: string;
}

export const FeedSkeleton: React.FC<FeedSkeletonProps> = ({
  count = 3,
  className,
}) => {
  const getTypeForIndex = (index: number): MediaType => {
    const types: MediaType[] = [
      "livestream",
      "room",
      "podcast",
      "room",
      "livestream",
      "podcast",
    ];
    return types[index % types.length];
  };

  return (
    <div className={clsx("space-y-4 sm:space-y-6 pb-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <MediaSkeleton key={index} type={getTypeForIndex(index)} />
      ))}
    </div>
  );
};

export default MediaSkeleton;
