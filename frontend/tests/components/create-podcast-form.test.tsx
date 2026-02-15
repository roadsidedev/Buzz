/**
 * Tests for CreatePodcastForm Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatePodcastForm } from '../../src/components/forms/create-podcast-form';

describe('CreatePodcastForm Component', () => {
  const mockOnSubmit = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form fields', () => {
    render(<CreatePodcastForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText('Create Podcast')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter podcast title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter podcast description')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(<CreatePodcastForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', { name: /Create Podcast/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
      expect(screen.getByText('Description is required')).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should validate title length', async () => {
    const user = userEvent.setup();
    render(<CreatePodcastForm onSubmit={mockOnSubmit} />);

    const titleInput = screen.getByPlaceholderText('Enter podcast title');
    await user.type(titleInput, 'ab');

    const submitButton = screen.getByRole('button', { name: /Create Podcast/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <CreatePodcastForm
        onSubmit={mockOnSubmit}
        onSuccess={mockOnSuccess}
      />
    );

    const titleInput = screen.getByPlaceholderText('Enter podcast title');
    const descriptionInput = screen.getByPlaceholderText('Enter podcast description');

    await user.type(titleInput, 'My Podcast');
    await user.type(descriptionInput, 'This is my podcast description');

    const submitButton = screen.getByRole('button', { name: /Create Podcast/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'My Podcast',
        description: 'This is my podcast description',
        category: 'tech',
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should display API errors', async () => {
    const error = new Error('Failed to create podcast');
    render(<CreatePodcastForm onSubmit={mockOnSubmit} error={error} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to create podcast')).toBeInTheDocument();
  });

  it('should disable form during submission', async () => {
    render(<CreatePodcastForm onSubmit={mockOnSubmit} isLoading={true} />);

    const submitButton = screen.getByRole('button', { name: /Creating/i });
    expect(submitButton).toBeDisabled();

    const titleInput = screen.getByPlaceholderText('Enter podcast title');
    expect(titleInput).toBeDisabled();
  });

  it('should allow category selection', async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValue(undefined);

    render(
      <CreatePodcastForm
        onSubmit={mockOnSubmit}
        onSuccess={mockOnSuccess}
      />
    );

    const categorySelect = screen.getByDisplayValue('tech');
    await user.selectOptions(categorySelect, 'finance');

    const titleInput = screen.getByPlaceholderText('Enter podcast title');
    const descriptionInput = screen.getByPlaceholderText('Enter podcast description');

    await user.type(titleInput, 'Finance Podcast');
    await user.type(descriptionInput, 'Discussion about finance');

    const submitButton = screen.getByRole('button', { name: /Create Podcast/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'finance',
        })
      );
    });
  });

  it('should clear form after successful submission', async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    const user = userEvent.setup();

    const { rerender } = render(
      <CreatePodcastForm
        onSubmit={mockOnSubmit}
        onSuccess={mockOnSuccess}
      />
    );

    const titleInput = screen.getByPlaceholderText('Enter podcast title') as HTMLInputElement;
    const descriptionInput = screen.getByPlaceholderText('Enter podcast description') as HTMLTextAreaElement;

    await user.type(titleInput, 'Test Podcast');
    await user.type(descriptionInput, 'Test description');

    const submitButton = screen.getByRole('button', { name: /Create Podcast/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(titleInput.value).toBe('');
      expect(descriptionInput.value).toBe('');
    });
  });
});
