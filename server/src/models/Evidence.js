const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Evidence title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
    },
    storedFilename: {
      type: String,
      required: [true, 'Stored filename is required'],
      trim: true,
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
    },
    fileCategory: {
      type: String,
      enum: ['document', 'image', 'audio', 'video', 'archive', 'text', 'other'],
      default: 'document',
    },
    originalSize: {
      type: Number,
      required: [true, 'Original file size is required'],
    },
    encryptedSize: {
      type: Number,
      required: [true, 'Encrypted file size is required'],
    },
    sha256Hash: {
      type: String,
      required: [true, 'SHA-256 integrity hash is required'],
      length: 64,
    },
    gridFSFileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'GridFS file identifier is required'],
      index: true,
    },
    encryption: {
      algorithm: {
        type: String,
        default: 'AES-256-GCM',
      },
      iv: {
        type: String,
        required: [true, 'Initialization Vector (IV) is required'],
      },
      authTag: {
        type: String,
        required: [true, 'Authentication Tag (authTag) is required'],
      },
    },
    authorizedRecipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmergencyContact',
      },
    ],
    releaseRule: {
      type: String,
      enum: ['ALL_CONTACTS', 'SELECTED_CONTACTS', 'PRE_AUTHORIZED_ONLY'],
      default: 'ALL_CONTACTS',
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    lastDownloadedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user query performance
evidenceSchema.index({ user: 1, createdAt: -1 });

const Evidence = mongoose.model('Evidence', evidenceSchema);

module.exports = Evidence;

