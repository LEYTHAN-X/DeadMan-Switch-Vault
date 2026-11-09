const path = require('path');
const Evidence = require('../../models/Evidence');
const { encryptBuffer, decryptBuffer, calculateHash } = require('../encryption/encryption.service');
const { uploadToGridFS, downloadFromGridFS, deleteFromGridFS } = require('./gridfs.service');
const { getFileCategory } = require('../../middleware/upload.middleware');
const logger = require('../../utils/logger');

/**
 * Upload and encrypt evidence file into GridFS
 */
const uploadEvidence = async (userId, file, payload = {}) => {
  if (!file || !file.buffer) {
    const error = new Error('No evidence file provided for upload.');
    error.statusCode = 400;
    throw error;
  }

  const title = payload.title?.trim() || file.originalname;
  const description = payload.description?.trim() || '';
  const releaseRule = payload.releaseRule || 'ALL_CONTACTS';

  // Sanitize filename and create unique stored name
  const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storedFilename = `enc_${userId}_${Date.now()}_${safeFilename}`;
  const category = getFileCategory(file.mimetype);

  // 1. Encrypt raw buffer with AES-256-GCM and compute original SHA-256 hash
  const { encryptedBuffer, iv, authTag, sha256Hash, originalSize, encryptedSize } = encryptBuffer(file.buffer);

  // 2. Persist encrypted ciphertext into MongoDB GridFS
  const gridFSFileId = await uploadToGridFS(storedFilename, encryptedBuffer, {
    owner: userId,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    category,
    sha256Hash,
  });

  // 3. Create metadata and security index document
  const evidence = await Evidence.create({
    user: userId,
    title,
    description,
    originalFilename: file.originalname,
    storedFilename,
    mimeType: file.mimetype,
    fileCategory: category,
    originalSize,
    encryptedSize,
    sha256Hash,
    gridFSFileId,
    encryption: {
      algorithm: 'AES-256-GCM',
      iv,
      authTag,
    },
    releaseRule,
  });

  logger.info(`Evidence uploaded and AES-256-GCM encrypted: ${evidence._id} for user ${userId}`);

  return {
    id: evidence._id,
    title: evidence.title,
    description: evidence.description,
    originalFilename: evidence.originalFilename,
    mimeType: evidence.mimeType,
    fileCategory: evidence.fileCategory,
    originalSize: evidence.originalSize,
    encryptedSize: evidence.encryptedSize,
    sha256Hash: evidence.sha256Hash,
    createdAt: evidence.createdAt,
  };
};

/**
 * Retrieve all evidence files owned by a user
 */
const getUserEvidenceList = async (userId) => {
  const items = await Evidence.find({ user: userId })
    .sort({ createdAt: -1 })
    .select('-encryption.iv -encryption.authTag');

  return items.map((doc) => ({
    id: doc._id,
    title: doc.title,
    description: doc.description,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    fileCategory: doc.fileCategory,
    originalSize: doc.originalSize,
    encryptedSize: doc.encryptedSize,
    sha256Hash: doc.sha256Hash,
    releaseRule: doc.releaseRule,
    downloadCount: doc.downloadCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }));
};

/**
 * Retrieve specific evidence metadata with ownership verification
 */
const getEvidenceById = async (userId, evidenceId) => {
  const evidence = await Evidence.findById(evidenceId).select('-encryption.iv -encryption.authTag');

  if (!evidence) {
    const error = new Error('Evidence record not found.');
    error.statusCode = 404;
    throw error;
  }

  // IDOR Protection: verify requesting user owns the evidence
  if (evidence.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: You are not authorized to view this evidence record.');
    error.statusCode = 403;
    throw error;
  }

  return evidence;
};

/**
 * Decrypts and streams evidence file with integrity check
 */
const downloadEvidence = async (userId, evidenceId) => {
  const evidence = await Evidence.findById(evidenceId);

  if (!evidence) {
    const error = new Error('Evidence record not found.');
    error.statusCode = 404;
    throw error;
  }

  // IDOR Protection
  if (evidence.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: You are not authorized to download this evidence.');
    error.statusCode = 403;
    throw error;
  }

  // 1. Fetch ciphertext from GridFS
  const ciphertextBuffer = await downloadFromGridFS(evidence.gridFSFileId);

  // 2. Decrypt with AES-256-GCM
  const decryptedBuffer = decryptBuffer(ciphertextBuffer, evidence.encryption.iv, evidence.encryption.authTag);

  // 3. Cryptographic assertion: Verify SHA-256 digest matches original upload
  const decryptedHash = calculateHash(decryptedBuffer);
  if (decryptedHash !== evidence.sha256Hash) {
    logger.error(`Cryptographic integrity failure for evidence ${evidenceId}: hash mismatch!`);
    const error = new Error('Integrity verification failed: Decrypted evidence hash does not match original digest.');
    error.statusCode = 500;
    throw error;
  }

  // 4. Update download audit counters
  evidence.downloadCount += 1;
  evidence.lastDownloadedAt = new Date();
  await evidence.save();

  logger.info(`Evidence decrypted and retrieved: ${evidenceId} by user ${userId}`);

  return {
    decryptedBuffer,
    originalFilename: evidence.originalFilename,
    mimeType: evidence.mimeType,
    originalSize: evidence.originalSize,
  };
};

/**
 * Permanently delete evidence and its GridFS chunks
 */
const deleteEvidence = async (userId, evidenceId) => {
  const evidence = await Evidence.findById(evidenceId);

  if (!evidence) {
    const error = new Error('Evidence record not found.');
    error.statusCode = 404;
    throw error;
  }

  // IDOR Protection
  if (evidence.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: You are not authorized to delete this evidence.');
    error.statusCode = 403;
    throw error;
  }

  // 1. Delete chunks from GridFS
  await deleteFromGridFS(evidence.gridFSFileId);

  // 2. Delete database document
  await Evidence.findByIdAndDelete(evidenceId);

  logger.info(`Evidence permanently deleted from GridFS and database: ${evidenceId}`);

  return { success: true, message: 'Evidence permanently shredded and deleted.' };
};

module.exports = {
  uploadEvidence,
  getUserEvidenceList,
  getEvidenceById,
  downloadEvidence,
  deleteEvidence,
};

