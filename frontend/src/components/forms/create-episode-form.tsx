/**
 * Create Episode Form
 *
 * Lets users generate a new podcast episode with:
 * - Title and description
 * - Source URLs for grounding the content
 * - Format: Single Host (monologue) or Dialogue (NotebookLM-style two-host)
 */

import React, { useState } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { CreateEpisodeRequest } from '../../types';
import { Plus, Trash2, Mic, Users } from 'lucide-react';

interface CreateEpisodeFormProps {
  podcastId: string;
  onSubmit: (payload: CreateEpisodeRequest) => Promise<void>;
  isLoading?: boolean;
  error?: Error | null;
}

export function CreateEpisodeForm({
  podcastId,
  onSubmit,
  isLoading = false,
  error = null,
}: CreateEpisodeFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<'monologue' | 'dialogue'>('monologue');
  const [sourceUrls, setSourceUrls] = useState<string[]>(['']);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = 'Title is required';
    else if (title.length < 3) errors.title = 'Title must be at least 3 characters';
    else if (title.length > 200) errors.title = 'Title must be less than 200 characters';

    if (format === 'dialogue') {
      const validUrls = sourceUrls.filter((u) => u.trim());
      if (validUrls.length === 0) {
        errors.sourceUrls = 'At least one source URL is recommended for Dialogue mode';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const cleanUrls = sourceUrls.filter((u) => u.trim());

    await onSubmit({
      podcastId,
      title: title.trim(),
      description: description.trim() || undefined,
      format,
      sourceUrls: cleanUrls.length > 0 ? cleanUrls : undefined,
    });
  };

  const addUrlField = () => setSourceUrls((prev) => [...prev, '']);
  const removeUrlField = (idx: number) =>
    setSourceUrls((prev) => prev.filter((_, i) => i !== idx));
  const updateUrl = (idx: number, value: string) =>
    setSourceUrls((prev) => prev.map((u, i) => (i === idx ? value : u)));

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 border-2 border-black">
      <h2 className="text-2xl font-bold uppercase">Generate Episode</h2>

      {error && (
        <div className="p-4 border-2 border-red-500 bg-red-50">
          <p className="text-red-700 font-semibold text-sm">{error.message}</p>
        </div>
      )}

      {/* Title */}
      <Input
        label="Episode Title"
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What is this episode about?"
        error={validationErrors.title}
        disabled={isLoading}
        maxLength={200}
      />

      {/* Description */}
      <Textarea
        label="Description (optional)"
        name="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Brief description of this episode"
        disabled={isLoading}
        maxLength={500}
      />

      {/* Format selector */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold uppercase">Format</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormat('monologue')}
            className={`p-4 border-2 text-left transition-colors ${
              format === 'monologue'
                ? 'border-black bg-black text-white'
                : 'border-gray-300 hover:border-gray-600'
            }`}
          >
            <Mic size={20} className="mb-2" />
            <p className="font-bold text-sm">Single Host</p>
            <p className={`text-xs mt-1 ${format === 'monologue' ? 'text-gray-300' : 'text-gray-500'}`}>
              One AI voice reads through the topic
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFormat('dialogue')}
            className={`p-4 border-2 text-left transition-colors ${
              format === 'dialogue'
                ? 'border-black bg-black text-white'
                : 'border-gray-300 hover:border-gray-600'
            }`}
          >
            <Users size={20} className="mb-2" />
            <p className="font-bold text-sm">Dialogue</p>
            <p className={`text-xs mt-1 ${format === 'dialogue' ? 'text-gray-300' : 'text-gray-500'}`}>
              Two AI hosts discuss your sources (NotebookLM-style)
            </p>
          </button>
        </div>
      </div>

      {/* Source URLs */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold uppercase">
          Source URLs{' '}
          {format === 'dialogue' && (
            <span className="text-cyan-600 normal-case font-normal">(recommended for Dialogue)</span>
          )}
        </label>
        <p className="text-xs text-gray-500">
          {format === 'dialogue'
            ? 'Paste article or document URLs. The hosts will discuss them directly.'
            : 'Optional URLs the script will reference.'}
        </p>
        <div className="space-y-2">
          {sourceUrls.map((url, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => updateUrl(idx, e.target.value)}
                placeholder="https://..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 border-2 border-gray-300 focus:border-black focus:outline-none text-sm font-inter"
              />
              {sourceUrls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeUrlField(idx)}
                  className="p-2 border-2 border-gray-300 hover:border-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {validationErrors.sourceUrls && (
            <p className="text-yellow-600 text-xs font-medium">{validationErrors.sourceUrls}</p>
          )}
          {sourceUrls.length < 5 && (
            <button
              type="button"
              onClick={addUrlField}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-black transition-colors"
            >
              <Plus size={12} /> Add another URL
            </button>
          )}
        </div>
      </div>

      <Button type="submit" variant="primary" disabled={isLoading} className="w-full">
        {isLoading
          ? 'Generating...'
          : format === 'dialogue'
          ? 'Generate Dialogue Episode'
          : 'Generate Episode'}
      </Button>
    </form>
  );
}
