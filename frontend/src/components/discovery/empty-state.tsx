/**
 * EmptyState Component
 * Shown when no results are available
 */

import React from "react";
import { Search, Filter } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "search" | "category" | "rooms";
}

/**
 * EmptyState Component
 * Shows friendly message when no data is available
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No results found",
  description = "Try adjusting your search or filters",
  icon,
  action,
  variant = "search",
}) => {
  const defaultIcons = {
    search: <Search className="w-12 h-12 text-gray-400" />,
    category: <Filter className="w-12 h-12 text-gray-400" />,
    rooms: <Search className="w-12 h-12 text-gray-400" />,
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="mb-4">
        {icon || defaultIcons[variant]}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>

      <p className="text-sm text-gray-500 text-center mb-6 max-w-sm">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}

      {/* Helpful Tips */}
      <div className="mt-8 pt-8 border-t border-gray-200 max-w-sm">
        <p className="text-xs font-medium text-gray-600 mb-3">Tips:</p>
        <ul className="text-xs text-gray-500 space-y-2">
          <li>• Try different keywords</li>
          <li>• Check your filters</li>
          <li>• Browse other categories</li>
          <li>• Check back later for new rooms</li>
        </ul>
      </div>
    </div>
  );
};

/**
 * NoResultsEmpty Component
 * Specific variant for search with no results
 */
export const NoResultsEmpty: React.FC<{
  query: string;
  onClear: () => void;
}> = ({ query, onClear }) => (
  <EmptyState
    title={`No results for "${query}"`}
    description="We couldn't find any rooms matching your search. Try a different query or browse categories."
    variant="search"
    action={{
      label: "Clear Search",
      onClick: onClear,
    }}
  />
);

/**
 * NoCategoryRoomsEmpty Component
 * Specific variant for category with no rooms
 */
export const NoCategoryRoomsEmpty: React.FC<{
  categoryName: string;
  onBack: () => void;
}> = ({ categoryName, onBack }) => (
  <EmptyState
    title={`No rooms in ${categoryName}`}
    description="Check back later when new rooms are created in this category."
    variant="category"
    action={{
      label: "Back to All Rooms",
      onClick: onBack,
    }}
  />
);

/**
 * NoLiveRoomsEmpty Component
 * Specific variant for no live rooms
 */
export const NoLiveRoomsEmpty: React.FC = () => (
  <EmptyState
    title="No rooms currently live"
    description="All rooms are currently offline. Check back soon!"
    variant="rooms"
  />
);

export default EmptyState;
