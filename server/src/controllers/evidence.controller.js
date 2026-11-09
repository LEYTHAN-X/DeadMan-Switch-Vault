const evidenceService = require('../services/evidence/evidence.service');

/**
 * Upload & encrypt new evidence file
 * @route POST /api/evidence/upload
 */
const uploadFile = async (req, res, next) => {
  try {
    const evidence = await evidenceService.uploadEvidence(req.user._id, req.file, req.body);

    res.status(201).json({
      success: true,
      message: 'Evidence successfully encrypted and deposited into vault.',
      data: evidence,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List all evidence items for the authenticated user
 * @route GET /api/evidence
 */
const listUserEvidence = async (req, res, next) => {
  try {
    const items = await evidenceService.getUserEvidenceList(req.user._id);

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get details of a specific evidence item
 * @route GET /api/evidence/:id
 */
const getEvidence = async (req, res, next) => {
  try {
    const item = await evidenceService.getEvidenceById(req.user._id, req.params.id);

    res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Decrypt and download evidence file
 * @route GET /api/evidence/:id/download
 */
const downloadFile = async (req, res, next) => {
  try {
    const { decryptedBuffer, originalFilename, mimeType, originalSize } = await evidenceService.downloadEvidence(
      req.user._id,
      req.params.id
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', originalSize);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFilename)}"`);

    res.send(decryptedBuffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Permanently delete evidence
 * @route DELETE /api/evidence/:id
 */
const removeEvidence = async (req, res, next) => {
  try {
    const result = await evidenceService.deleteEvidence(req.user._id, req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  listUserEvidence,
  getEvidence,
  downloadFile,
  removeEvidence,
};

