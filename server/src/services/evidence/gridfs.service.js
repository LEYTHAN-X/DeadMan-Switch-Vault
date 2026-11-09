const mongoose = require('mongoose');
const { Readable } = require('stream');
const logger = require('../../utils/logger');

let bucket = null;

/**
 * Initializes and returns the GridFSBucket for encrypted evidence
 */
const getBucket = () => {
  if (!mongoose.connection.db) {
    throw new Error('Database connection not established. GridFS bucket unavailable.');
  }

  if (!bucket) {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'evidence',
      chunkSizeBytes: 255 * 1024, // 255 KB per chunk
    });
    logger.info('GridFS Bucket initialized: evidence');
  }

  return bucket;
};

/**
 * Uploads an encrypted file buffer to GridFS
 * @param {string} filename Stored filename
 * @param {Buffer} encryptedBuffer
 * @param {object} metadata
 * @returns {Promise<mongoose.Types.ObjectId>}
 */
const uploadToGridFS = (filename, encryptedBuffer, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const gridfs = getBucket();
    const uploadStream = gridfs.openUploadStream(filename, {
      metadata: {
        ...metadata,
        uploadedAt: new Date(),
      },
    });

    const readable = new Readable();
    readable.push(encryptedBuffer);
    readable.push(null);

    readable
      .pipe(uploadStream)
      .on('error', (err) => {
        logger.error(`GridFS upload error: ${err.message}`);
        reject(err);
      })
      .on('finish', () => {
        logger.info(`File successfully written to GridFS: ${uploadStream.id} (${filename})`);
        resolve(uploadStream.id);
      });
  });
};

/**
 * Reads an encrypted file from GridFS as a single Buffer
 * @param {string|mongoose.Types.ObjectId} fileId
 * @returns {Promise<Buffer>}
 */
const downloadFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    const gridfs = getBucket();
    const objectId = new mongoose.Types.ObjectId(fileId);

    const downloadStream = gridfs.openDownloadStream(objectId);
    const chunks = [];

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('error', (err) => {
      logger.error(`GridFS download error for ${fileId}: ${err.message}`);
      reject(err);
    });

    downloadStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

/**
 * Deletes an encrypted file and its chunks from GridFS
 * @param {string|mongoose.Types.ObjectId} fileId
 * @returns {Promise<void>}
 */
const deleteFromGridFS = async (fileId) => {
  const gridfs = getBucket();
  const objectId = new mongoose.Types.ObjectId(fileId);
  await gridfs.delete(objectId);
  logger.info(`Deleted GridFS file and associated chunks: ${fileId}`);
};

module.exports = {
  getBucket,
  uploadToGridFS,
  downloadFromGridFS,
  deleteFromGridFS,
};

