const multer = require('multer');

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Allowed MIME types whitelist
const ALLOWED_MIME_TYPES = new Set([
  // Documents & Text
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',

  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/mp4',
  'audio/webm',
  'audio/x-m4a',

  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-matroska',
]);

/**
 * Determine high-level category from MIME type
 * @param {string} mimeType
 * @returns {'document' | 'image' | 'audio' | 'video' | 'text' | 'other'}
 */
const getFileCategory = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'application/json') {
    return 'text';
  }
  return 'document';
};

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    const error = new Error(
      `Unsupported file type: ${file.mimetype}. Allowed types include PDF, documents, images, audio, and video.`
    );
    error.statusCode = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Single file per upload action
  },
  fileFilter,
});

module.exports = {
  upload,
  getFileCategory,
  MAX_FILE_SIZE,
};

