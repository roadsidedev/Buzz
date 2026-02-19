/**
 * AdvancedSearchModal
 * Full-featured search with filters, recent searches, and suggestions
 * ~200 lines
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { Category } from "common/types/discovery";
import type { FilterState } from "../../hooks/use-filter-persistence";

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, filters?: FilterState) => void;
  categories?: Category[];
  onClearFilters?: () => void;
  initialFilters?: FilterState;
}

const ROOM_TYPES = ["debate", "coding", "trading", "research"];
const STATUSES = ["live", "upcoming", "archived"];
const SORT_OPTIONS = ["trending", "newest", "viewers", "activity"];

/**
 * AdvancedSearchModal Component
 */
export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  onSearch,
  categories = [],
  onClearFilters,
  initialFilters,
}) => {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(initialFilters || {});
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load recent searches on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("search:recent");
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      }
    } catch (err) {
      console.error("Failed to load recent searches:", err);
    }
  }, [isOpen]);

  // Generate suggestions based on categories
  const availableSuggestions = useMemo(() => {
    if (!query.trim()) return [];
    const lower = query.toLowerCase();
    return categories
      .filter((c) => c.name.toLowerCase().includes(lower))
      .map((c) => c.name)
      .slice(0, 5);
  }, [query, categories]);

  // Handle query input with debounce for suggestions
  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      setSuggestions(availableSuggestions);
      setShowSuggestions(!!value.trim());
    },
    [availableSuggestions]
  );

  // Handle filter change
  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: any) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  // Handle search submission
  const handleSearch = useCallback(
    (searchQuery: string = query) => {
      if (!searchQuery.trim()) return;

      // Save to recent searches
      setRecentSearches((prev) => {
        const updated = [searchQuery, ...prev.filter((s) => s !== searchQuery)].slice(
          0,
          5
        );
        try {
          localStorage.setItem("search:recent", JSON.stringify(updated));
        } catch (err) {
          console.error("Failed to save recent search:", err);
        }
        return updated;
      });

      onSearch(searchQuery, filters);
      onClose();
    },
    [query, filters, onSearch, onClose]
  );

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    handleSearch(suggestion);
  }, [handleSearch]);

  // Handle recent search click
  const handleRecentClick = useCallback(
    (search: string) => {
      setQuery(search);
      handleSearch(search);
    },
    [handleSearch]
  );

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setFilters({});
    onClearFilters?.();
  }, [onClearFilters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close search modal"
      />

      {/* Modal */}
      <div className="relative mx-auto my-8 max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Advanced Search</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Search Input */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Search Query
            </label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search rooms, agents, topics..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 border-b last:border-b-0"
                    >
                      <span className="text-sm text-gray-700">{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Categories
              </label>
              <select
                multiple
                value={filters.categories || []}
                onChange={(e) =>
                  handleFilterChange(
                    "categories",
                    Array.from(e.target.selectedOptions, (o) => o.value)
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                size={4}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            {/* Room Type Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Room Type
              </label>
              <select
                value={filters.roomType || ""}
                onChange={(e) => handleFilterChange("roomType", e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {ROOM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.status || "all"}
                onChange={(e) =>
                  handleFilterChange("status", e.target.value === "all" ? undefined : e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy || "trending"}
                onChange={(e) => handleFilterChange("sortBy", e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map((sort) => (
                  <option key={sort} value={sort}>
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Recent Searches
              </label>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search) => (
                  <button
                    key={search}
                    onClick={() => handleRecentClick(search)}
                    className="px-3 py-1 rounded-full bg-gray-100 text-sm text-gray-700 hover:bg-gray-200"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          <button
            onClick={handleClearFilters}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Clear Filters
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSearch()}
              disabled={!query.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearchModal;
