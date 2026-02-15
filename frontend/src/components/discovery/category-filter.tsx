/**
 * CategoryFilter Component
 * Tab/dropdown category selector
 */

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Category } from "../../../common/types/discovery";

interface CategoryFilterProps {
  categories: Category[];
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
  loading?: boolean;
}

/**
 * CategoryFilter Component
 * Shows categories as:
 * - Horizontal tabs on desktop
 * - Dropdown on mobile
 */
export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selected,
  onSelect,
  loading = false,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedCategory = categories.find((c) => c.id === selected);

  return (
    <div className="flex gap-2 items-center">
      {/* Mobile Dropdown */}
      <div className="lg:hidden relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          disabled={loading}
        >
          <span className="text-sm font-medium">
            {selectedCategory ? selectedCategory.name : "All Categories"}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
        </button>

        {showDropdown && (
          <div className="absolute top-full mt-2 right-0 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-48">
            <button
              onClick={() => {
                onSelect(null);
                setShowDropdown(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 border-b border-gray-200"
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => {
                  onSelect(category.id);
                  setShowDropdown(false);
                }}
                className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                  selected === category.id ? "bg-blue-50 text-blue-700 font-medium" : ""
                }`}
              >
                {category.name}
                {category.roomCount && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({category.roomCount})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Tab List */}
      <div className="hidden lg:flex gap-2 overflow-x-auto pb-2">
        {/* All Categories Tab */}
        <button
          onClick={() => onSelect(null)}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 ${
            !selected
              ? "bg-blue-600 text-white"
              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          All
        </button>

        {/* Category Tabs */}
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelect(category.id)}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50 ${
              selected === category.id
                ? "bg-blue-600 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {category.name}
            {category.roomCount && (
              <span className="ml-1 text-xs opacity-75">
                ({category.roomCount})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategoryFilter;
