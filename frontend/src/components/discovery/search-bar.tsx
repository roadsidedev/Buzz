/**
 * SearchBar Component
 * Search input with debouncing and optional suggestions
 */

import React, { useState, useCallback, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onClear?: () => void;
  isLoading?: boolean;
  suggestions?: string[];
  autoFocus?: boolean;
}

/**
 * SearchBar Component
 * Features:
 * - Debounced search (300ms)
 * - Clear button
 * - Loading state
 * - Optional suggestions dropdown
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search rooms, agents, or topics...",
  onSearch,
  onClear,
  isLoading = false,
  suggestions = [],
  autoFocus = true,
}) => {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search on debounced query change
  useEffect(() => {
    if (debouncedQuery.trim()) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, onSearch]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);

      if (value.trim()) {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    },
    []
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setShowSuggestions(false);
    setDebouncedQuery("");
    onClear?.();
  }, [onClear]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setDebouncedQuery(suggestion);
    onSearch(suggestion);
  }, [onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleClear();
      } else if (e.key === "Enter") {
        setShowSuggestions(false);
      }
    },
    [handleClear]
  );

  return (
    <div className="relative w-full max-w-2xl">
      {/* Search Input Container */}
      <div className="relative flex items-center bg-white rounded-lg border border-gray-300 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
        {/* Search Icon */}
        <Search className="ml-3 w-5 h-5 text-gray-400 flex-shrink-0" />

        {/* Input Field */}
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={isLoading}
          className="flex-1 px-3 py-2.5 text-sm font-medium placeholder-gray-500 border-0 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
          aria-label="Search rooms"
        />

        {/* Loading or Clear Button */}
        <div className="mr-3 flex-shrink-0">
          {isLoading ? (
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          ) : query.trim() ? (
            <button
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
          <ul className="max-h-48 overflow-y-auto divide-y divide-gray-200">
            {suggestions.map((suggestion, index) => (
              <li key={index}>
                <button
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">{suggestion}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Search Tips */}
      {query.trim().length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 text-xs text-gray-500 px-1">
          <p className="font-medium mb-1">Try searching for:</p>
          <ul className="list-disc list-inside space-y-0.5 text-gray-400">
            <li>Room topics (e.g., "AI", "Coding")</li>
            <li>Agent names (e.g., "Alice")</li>
            <li>Categories (e.g., "Debate")</li>
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * SearchBarWithFilters Component
 * SearchBar with additional filter controls
 */
interface SearchBarWithFiltersProps
  extends Omit<SearchBarProps, "onSearch"> {
  onSearch: (query: string, filters?: SearchFilters) => void;
  onFilterChange?: (filters: SearchFilters) => void;
  categories?: Array<{ id: string; name: string }>;
}

export interface SearchFilters {
  categoryId?: string;
  sortBy?: "relevance" | "trending" | "newest" | "viewers";
}

export const SearchBarWithFilters: React.FC<SearchBarWithFiltersProps> = ({
  placeholder,
  onSearch,
  onFilterChange,
  onClear,
  isLoading,
  suggestions,
  categories = [],
  autoFocus,
}) => {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [query, setQuery] = useState("");

  const handleSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);
      onSearch(searchQuery, filters);
    },
    [filters, onSearch]
  );

  const handleFilterChange = useCallback(
    (newFilters: SearchFilters) => {
      setFilters(newFilters);
      onFilterChange?.(newFilters);
      if (query.trim()) {
        onSearch(query, newFilters);
      }
    },
    [query, onSearch, onFilterChange]
  );

  const handleClearAll = useCallback(() => {
    setQuery("");
    setFilters({});
    onClear?.();
  }, [onClear]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search Input */}
      <SearchBar
        placeholder={placeholder}
        onSearch={handleSearch}
        onClear={handleClearAll}
        isLoading={isLoading}
        suggestions={suggestions}
        autoFocus={autoFocus}
      />

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Category Filter */}
        {categories.length > 0 && (
          <select
            value={filters.categoryId || ""}
            onChange={(e) =>
              handleFilterChange({
                ...filters,
                categoryId: e.target.value || undefined,
              })
            }
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        )}

        {/* Sort Filter */}
        <select
          value={filters.sortBy || "relevance"}
          onChange={(e) =>
            handleFilterChange({
              ...filters,
              sortBy: e.target.value as SearchFilters["sortBy"],
            })
          }
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label="Sort results"
        >
          <option value="relevance">Most Relevant</option>
          <option value="trending">Trending</option>
          <option value="newest">Newest</option>
          <option value="viewers">Most Viewers</option>
        </select>

        {/* Active Filters Indicator */}
        {(filters.categoryId || filters.sortBy !== "relevance") && (
          <button
            onClick={handleClearAll}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
