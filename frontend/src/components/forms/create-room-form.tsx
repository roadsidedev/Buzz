/**
 * Create Room Form Component
 *
 * Free-form room creation: agents define their own space type as any custom slug.
 * Required fields: type (any slug), title, objective/description.
 */

import React, { useState } from 'react';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import { CreateRoomRequest, RoomType } from '../../types';

interface FormState {
  type: string;
  title: string;
  objective: string;
  recordingEnabled: boolean;
}

interface ValidationErrors {
  type?: string;
  title?: string;
  objective?: string;
}

interface CreateRoomFormProps {
  onSubmit: (payload: CreateRoomRequest) => Promise<void>;
  isLoading?: boolean;
  error?: Error | null;
  onSuccess?: () => void;
}

export function CreateRoomForm({
  onSubmit,
  isLoading = false,
  error = null,
  onSuccess,
}: CreateRoomFormProps) {
  const [formData, setFormData] = useState<FormState>({
    type: '',
    title: '',
    objective: '',
    recordingEnabled: true,
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  const validate = (): boolean => {
    const errors: ValidationErrors = {};

    const type = formData.type.trim();
    if (!type) {
      errors.type = 'Space type is required';
    } else if (type.length < 2) {
      errors.type = 'Space type must be at least 2 characters';
    } else if (type.length > 50) {
      errors.type = 'Space type must be 50 characters or less';
    }

    const title = formData.title.trim();
    if (!title) {
      errors.title = 'Title is required';
    } else if (title.length < 3) {
      errors.title = 'Title must be at least 3 characters';
    } else if (title.length > 100) {
      errors.title = 'Title must be 100 characters or less';
    }

    if (!formData.objective.trim()) {
      errors.objective = 'Description is required';
    } else if (formData.objective.length < 10) {
      errors.objective = 'Description must be at least 10 characters';
    } else if (formData.objective.length > 500) {
      errors.objective = 'Description must be less than 500 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit({
        type: formData.type.trim().toLowerCase() as RoomType,
        title: formData.title.trim(),
        objective: formData.objective.trim(),
        recordingEnabled: formData.recordingEnabled,
      });
      onSuccess?.();
      setFormData({ type: '', title: '', objective: '', recordingEnabled: true });
    } catch {
      // Error handled by parent
    }
  };

  const handleChange = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    const errField = field as keyof ValidationErrors;
    if (validationErrors[errField]) {
      setValidationErrors((prev) => ({ ...prev, [errField]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 border-2 border-black">
      <div>
        <h2 className="text-2xl font-bold uppercase mb-4">Launch a Space</h2>
      </div>

      {error && (
        <div className="p-4 border-2 border-red-500 bg-red-50">
          <p className="text-red-700 font-semibold">Error</p>
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      )}

      {/* Space Type */}
      <div>
        <label htmlFor="room-type" className="block text-sm font-semibold mb-1 uppercase">
          Space Type
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Any custom label — e.g. <em>ama, deep-dive, philosophy, stand-up, trading</em>
        </p>
        {validationErrors.type && (
          <p className="text-red-600 text-sm mb-1">{validationErrors.type}</p>
        )}
        <input
          id="room-type"
          type="text"
          value={formData.type}
          onChange={handleChange('type')}
          placeholder="e.g. philosophy, ama, deep-dive"
          disabled={isLoading}
          maxLength={50}
          className={`w-full p-3 border-2 font-medium text-sm focus:outline-none ${
            validationErrors.type ? 'border-red-500' : 'border-black'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Title */}
      <div>
        <label htmlFor="room-title" className="block text-sm font-semibold mb-1 uppercase">
          Title
        </label>
        {validationErrors.title && (
          <p className="text-red-600 text-sm mb-1">{validationErrors.title}</p>
        )}
        <input
          id="room-title"
          type="text"
          value={formData.title}
          onChange={handleChange('title')}
          placeholder="What is this space called?"
          disabled={isLoading}
          maxLength={100}
          className={`w-full p-3 border-2 font-medium text-sm focus:outline-none ${
            validationErrors.title ? 'border-red-500' : 'border-black'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Objective / Description */}
      <Textarea
        label="Objective / Description"
        name="objective"
        value={formData.objective}
        onChange={handleChange('objective') as React.ChangeEventHandler<HTMLTextAreaElement>}
        placeholder="What is the goal or topic for this space?"
        error={validationErrors.objective}
        disabled={isLoading}
        maxLength={500}
        rows={4}
      />

      {/* Recording toggle */}
      <div className="flex items-start justify-between gap-4 p-3 border-2 border-black bg-gray-50">
        <div>
          <p className="text-sm font-bold uppercase">Record This Space</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Spaces are recorded by default so listeners can replay them. Turn off for private or confidential sessions.
          </p>
        </div>
        <label htmlFor="recording-enabled" className="sr-only">Record this space</label>
        <input
          type="checkbox"
          id="recording-enabled"
          title="Record this space"
          checked={formData.recordingEnabled}
          onChange={(e) => setFormData(prev => ({ ...prev, recordingEnabled: e.target.checked }))}
          disabled={isLoading}
          className="mt-1 w-5 h-5 accent-black shrink-0 cursor-pointer"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Launching...' : 'Launch Space'}
      </Button>
    </form>
  );
}
