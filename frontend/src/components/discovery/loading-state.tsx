/**
 * LoadingState Component
 * Skeleton loaders for discovery page
 */

import React from "react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  count?: number;
}

/**
 * Skeleton Card Component
 * Animated placeholder for room card
 */
const SkeletonCard: React.FC = () => (
  <div className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden animate-pulse">
    {/* Image Skeleton */}
    <div className="h-40 bg-gray-200" />

    {/* Content Skeleton */}
    <div className="flex flex-1 flex-col p-4">
      {/* Host Info */}
      <div className="mb-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-300" />
        <div className="flex-1">
          <div className="h-3 bg-gray-200 rounded mb-1 w-20" />
          <div className="h-3 bg-gray-200 rounded w-32" />
        </div>
      </div>

      {/* Title */}
      <div className="mb-3 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 bg-gray-200 rounded" />
        ))}
      </div>

      {/* Progress Bar */}
      <div className="mb-3 h-1.5 bg-gray-200 rounded-full" />

      {/* Info */}
      <div className="h-3 bg-gray-200 rounded w-32 mb-3" />
    </div>

    {/* Button Skeleton */}
    <div className="border-t border-gray-100 p-3">
      <div className="h-10 bg-gray-200 rounded" />
    </div>
  </div>
);

/**
 * LoadingState Component
 * Displays skeleton loaders while data is loading
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  count = 6,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

/**
 * LoadingBar Component
 * Horizontal loading indicator
 */
export const LoadingBar: React.FC = () => (
  <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse rounded-full" />
);

/**
 * BeeSpinner Component
 * Animated flying bee loading indicator (Beely brand)
 */
export const BeeSpinner: React.FC<{ size?: "sm" | "md" | "lg" }> = ({
  size = "md",
}) => {
  const sizeClasses = { sm: "text-2xl", md: "text-4xl", lg: "text-6xl" };

  return (
    <div className="flex items-center justify-center pointer-events-none select-none">
      <span
        className={cn("animate-bee-fly", sizeClasses[size])}
        role="status"
        aria-label="Loading"
      >
        🐝
      </span>
    </div>
  );
};

/** Alias for backward compatibility */
export const LoadingSpinner = BeeSpinner;

/**
 * LoadingOverlay Component
 * Full-page loading overlay
 */
export const LoadingOverlay: React.FC = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3 shadow-xl">
      <BeeSpinner size="lg" />
      <p className="text-center text-gray-600 font-medium">Beely is loading…</p>
    </div>
  </div>
);

export default LoadingState;
