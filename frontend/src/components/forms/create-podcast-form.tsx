/**
 * Create Podcast Form Component
 *
 * Form for creating new podcasts with title, description, and category selection.
 * Uses Zod validation and provides user feedback via loading/error states.
 */

import React, { useState, useRef } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { MediaService } from '../../services/media';
import { CreatePodcastRequest, PodcastCategory } from '../../types';
import { Upload, CheckCircle } from 'lucide-react';
import { BeeSpinner } from '../discovery/loading-state';

const PODCAST_CATEGORIES: Array<{ value: PodcastCategory; label: string }> = [
  { value: 'tech', label: 'Technology' },
  { value: 'finance', label: 'Finance' },
  { value: 'creative', label: 'Creative' },
  { value: 'misc', label: 'Miscellaneous' },
];

interface CreatePodcastFormProps {
  onSubmit: (payload: CreatePodcastRequest) => Promise<void>;
  isLoading?: boolean;
  error?: Error | null;
  onSuccess?: () => void;
}

/**
 * Form component for creating new podcasts
 */
export function CreatePodcastForm({
  onSubmit,
  isLoading = false,
  error = null,
  onSuccess,
}: CreatePodcastFormProps) {
  const [formData, setFormData] = useState<CreatePodcastRequest>({
    title: '',
    description: '',
    category: 'tech',
    coverImageUrl: '',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof CreatePodcastRequest, string>>
  >({});

  /**
   * Validate form data
   */
  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length < 3) {
      errors.title = 'Title must be at least 3 characters';
    } else if (formData.title.length > 100) {
      errors.title = 'Title must be less than 100 characters';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      errors.description = 'Description must be at least 10 characters';
    } else if (formData.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }

    if (!formData.category) {
      errors.category = 'Category is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      await onSubmit(formData);
      onSuccess?.();
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: 'tech',
      });
    } catch {
      // Error is handled by parent component
    }
  };

  /**
   * Handle input change
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear validation error for this field
    if (validationErrors[name as keyof CreatePodcastRequest]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 border-2 border-black">
      <div>
        <h2 className="text-2xl font-bold uppercase mb-4">Create Podcast</h2>
      </div>

      {/* API Error */}
      {error && (
        <div className="p-4 border-2 border-red-500 bg-red-50">
          <p className="text-red-700 font-semibold">Error</p>
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      )}

      {/* Title Input */}
      <Input
        label="Podcast Title"
        name="title"
        value={formData.title}
        onChange={handleChange}
        placeholder="Enter podcast title"
        error={validationErrors.title}
        disabled={isLoading}
        maxLength={100}
      />

      {/* Description Textarea */}
      <Textarea
        label="Description"
        name="description"
        value={formData.description}
        onChange={handleChange}
        placeholder="Enter podcast description"
        error={validationErrors.description}
        disabled={isLoading}
        maxLength={500}
      />

      {/* Category Select */}
      <div>
        <label htmlFor="category" className="block text-sm font-semibold mb-2 uppercase">
          Category
        </label>
        <select
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          disabled={isLoading}
          className="w-full px-4 py-2 border-2 border-black font-inter focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {PODCAST_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        {validationErrors.category && (
          <p className="text-red-600 text-sm mt-1">{validationErrors.category}</p>
        )}
      </div>

      {/* Image Upload Section */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold uppercase">Cover Image (Album Art)</label>
        <div 
          className="border-2 border-dashed border-gray-300 p-4 text-center rounded hover:border-black transition-colors cursor-pointer bg-gray-50"
          onClick={() => fileInputRef.current?.click()}
        >
          {formData.coverImageUrl ? (
            <div className="flex items-center gap-4">
              <img src={formData.coverImageUrl} className="w-16 h-16 object-cover border border-black" alt="Preview" />
              <div className="text-left">
                <p className="text-green-600 font-bold text-sm flex items-center gap-1">
                  <CheckCircle size={14} /> Uploaded Successfully
                </p>
                <p className="text-xs text-gray-500">Click to replace</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-gray-400" />
              <p className="text-sm font-medium">Click to upload album art</p>
              {isUploading && (
                <div className="flex items-center gap-2 text-cyan-600 text-xs font-bold">
                  <BeeSpinner size="sm" /> Uploading...
                </div>
              )}
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setIsUploading(true);
              setUploadError(null);
              try {
                const res = await MediaService.upload(file);
                setFormData(prev => ({ ...prev, coverImageUrl: res.url }));
              } catch (err) {
                setUploadError(err instanceof Error ? err.message : "Upload failed");
              } finally {
                setIsUploading(false);
              }
            }}
          />
        </div>
        {uploadError && <p className="text-red-600 text-xs mt-1 font-bold">{uploadError}</p>}
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Creating...' : 'Create Podcast'}
      </Button>
    </form>
  );
}
