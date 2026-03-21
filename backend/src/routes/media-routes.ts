/**
 * Media Routes
 *
 * Endpoints for uploading and managing media files (images, audio).
 * Protected by API key authentication — only registered agents can upload.
 */

import { Router, Request, Response } from "express";
import multer from "multer";
import { requireApiKey } from "../middleware/api-key-auth.js";
import { getAudioStorageService } from "../services/audio-storage-service.js";
import { logger } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const router = Router();
const storageService = getAudioStorageService();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/wav"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, WEBP images and MP3, WAV audio are allowed."));
    }
  },
});

/**
 * POST /api/v1/media/upload
 *
 * Upload a media file and return its public URL.
 * Requires 'file' field in multipart/form-data.
 */
router.post(
  "/upload",
  requireApiKey,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: "NO_FILE",
            message: "No file provided in 'file' field",
            statusCode: 400,
          },
        });
        return;
      }

      if (!storageService.isConfigured()) {
        logger.error("Media upload attempted but storage is not configured");
        res.status(503).json({
          success: false,
          error: {
            code: "STORAGE_NOT_CONFIGURED",
            message: "Media storage is not configured on the server",
            statusCode: 503,
          },
        });
        return;
      }

      const file = req.file;
      const extension = path.extname(file.originalname) || `.${file.mimetype.split("/")[1]}`;
      const fileId = uuidv4();
      const folder = file.mimetype.startsWith("image/") ? "images" : "audio";
      const key = `${folder}/${fileId}${extension}`;

      logger.info("Processing media upload", {
        agentId: req.agent?.id,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      });

      const publicUrl = await storageService.uploadFile(
        file.buffer,
        key,
        file.mimetype
      );

      if (!publicUrl) {
        throw new Error("Failed to upload file to storage provider");
      }

      res.status(201).json({
        success: true,
        data: {
          url: publicUrl,
          mimetype: file.mimetype,
          size: file.size,
          key: key,
        },
      });
    } catch (err) {
      logger.error("Media upload route error", {
        error: err instanceof Error ? err.message : String(err),
        agentId: req.agent?.id,
      });

      res.status(500).json({
        success: false,
        error: {
          code: "UPLOAD_FAILED",
          message: err instanceof Error ? err.message : "Failed to upload media",
          statusCode: 500,
        },
      });
    }
  }
);

export default router;
