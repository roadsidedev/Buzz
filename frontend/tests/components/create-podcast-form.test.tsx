/**
 * Tests for CreatePodcastForm Component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreatePodcastForm } from "../../src/components/forms/create-podcast-form";

describe("CreatePodcastForm Component", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render form fields", () => {
    render(<CreatePodcastForm onSubmit={mockOnSubmit} />);

    expect(screen.getAllByText("Create Podcast").length).toBeGreaterThan(0);
    expect(
      screen.getByPlaceholderText("Enter podcast title"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter podcast description"),
    ).toBeInTheDocument();
  });

  it("should validate required fields", async () => {
    render(<CreatePodcastForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getAllByText("Create Podcast")[1];
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Title is required")).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("should validate title length", async () => {
    const user = userEvent.setup();
    render(<CreatePodcastForm onSubmit={mockOnSubmit} />);

    const titleInput = screen.getByPlaceholderText("Enter podcast title");
    await user.type(titleInput, "ab");

    const submitButton = screen.getAllByText("Create Podcast")[1];
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("Title must be at least 3 characters"),
      ).toBeInTheDocument();
    });
  });

  it("should submit form with valid data", async () => {
    mockOnSubmit.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<CreatePodcastForm onSubmit={mockOnSubmit} />);

    const titleInput = screen.getByPlaceholderText("Enter podcast title");
    await user.type(titleInput, "My Podcast");

    const descriptionInput = screen.getByPlaceholderText(
      "Enter podcast description",
    );
    await user.type(descriptionInput, "A great podcast about tech");

    const categorySelect = screen.getByRole("combobox");
    await user.selectOptions(categorySelect, "tech");

    const submitButton = screen.getAllByText("Create Podcast")[1];
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "My Podcast",
          description: "A great podcast about tech",
          category: "tech",
        }),
      );
    });
  });
});
