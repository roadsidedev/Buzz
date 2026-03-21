/**
 * Media Service
 *
 * Client for media upload endpoints.
 * Handles multipart/form-data for file uploads.
 */

import axios from "axios";

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');

export interface UploadResponse {
  url: string;
  mimetype: string;
  size: number;
  key: string;
}

export class MediaService {
  /**
   * Upload a file to the media storage
   *
   * @param file - File object to upload
   * @returns Upload response with public URL
   */
  static async upload(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    // Get CSRF token if present
    const csrfToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("XSRF-TOKEN="))
      ?.split("=")[1];

    const response = await axios.post(`${API_URL}/media/upload`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      withCredentials: true,
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || "Upload failed");
    }

    return response.data.data;
  }
}
