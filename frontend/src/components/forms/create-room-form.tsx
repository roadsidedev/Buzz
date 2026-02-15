/**
 * Create Room Form Component
 *
 * Form for creating live collaboration rooms with room type and objective input.
 * Supports debate, coding, research, trading, and simulation room types.
 */

import React, { useState } from 'react';
import { Button } from '../Button';
import { Textarea } from '../Textarea';
import { CreateRoomRequest, RoomType } from '../../types';

const ROOM_TYPES: Array<{ value: RoomType; label: string; description: string }> = [
  {
    value: 'debate',
    label: 'Debate',
    description: 'Structured argumentation on a topic',
  },
  {
    value: 'coding',
    label: 'Coding Session',
    description: 'Live programming collaboration',
  },
  {
    value: 'research',
    label: 'Research',
    description: 'Collaborative research and analysis',
  },
  {
    value: 'trading',
    label: 'Trading',
    description: 'Live market analysis and trading',
  },
  {
    value: 'simulation',
    label: 'Simulation',
    description: 'Scenario modeling and simulations',
  },
];

interface CreateRoomFormProps {
  onSubmit: (payload: CreateRoomRequest) => Promise<void>;
  isLoading?: boolean;
  error?: Error | null;
  onSuccess?: () => void;
}

/**
 * Form component for creating new live rooms
 */
export function CreateRoomForm({
  onSubmit,
  isLoading = false,
  error = null,
  onSuccess,
}: CreateRoomFormProps) {
  const [formData, setFormData] = useState<CreateRoomRequest>({
    type: 'debate',
    objective: '',
    constraints: {},
  });

  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<'type' | 'objective', string>>
  >({});

  /**
   * Validate form data
   */
  const validate = (): boolean => {
    const errors: typeof validationErrors = {};

    if (!formData.type) {
      errors.type = 'Room type is required';
    }

    if (!formData.objective.trim()) {
      errors.objective = 'Objective is required';
    } else if (formData.objective.length < 10) {
      errors.objective = 'Objective must be at least 10 characters';
    } else if (formData.objective.length > 500) {
      errors.objective = 'Objective must be less than 500 characters';
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
        type: 'debate',
        objective: '',
        constraints: {},
      });
    } catch {
      // Error is handled by parent component
    }
  };

  /**
   * Handle room type selection
   */
  const handleRoomTypeChange = (type: RoomType) => {
    setFormData((prev) => ({
      ...prev,
      type,
    }));
    if (validationErrors.type) {
      setValidationErrors((prev) => ({
        ...prev,
        type: undefined,
      }));
    }
  };

  /**
   * Handle objective change
   */
  const handleObjectiveChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      objective: value,
    }));
    if (validationErrors.objective) {
      setValidationErrors((prev) => ({
        ...prev,
        objective: undefined,
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 border-2 border-black">
      <div>
        <h2 className="text-2xl font-bold uppercase mb-4">Create Live Room</h2>
      </div>

      {/* API Error */}
      {error && (
        <div className="p-4 border-2 border-red-500 bg-red-50">
          <p className="text-red-700 font-semibold">Error</p>
          <p className="text-red-600 text-sm">{error.message}</p>
        </div>
      )}

      {/* Room Type Selection */}
      <div>
        <label className="block text-sm font-semibold mb-3 uppercase">Room Type</label>
        {validationErrors.type && (
          <p className="text-red-600 text-sm mb-2">{validationErrors.type}</p>
        )}
        <div className="space-y-2">
          {ROOM_TYPES.map((roomType) => (
            <button
              key={roomType.value}
              type="button"
              onClick={() => handleRoomTypeChange(roomType.value)}
              disabled={isLoading}
              className={`w-full p-4 border-2 text-left transition-all ${
                formData.type === roomType.value
                  ? 'border-black bg-black text-white'
                  : 'border-black bg-white hover:bg-gray-50'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="font-bold uppercase text-sm">{roomType.label}</div>
              <div className="text-xs opacity-75">{roomType.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Objective Textarea */}
      <Textarea
        label="Room Objective"
        name="objective"
        value={formData.objective}
        onChange={handleObjectiveChange}
        placeholder="What is the goal or topic for this room?"
        error={validationErrors.objective}
        disabled={isLoading}
        maxLength={500}
        rows={5}
      />

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? 'Creating Room...' : 'Create & Launch Room'}
      </Button>
    </form>
  );
}
