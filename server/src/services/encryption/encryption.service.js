const crypto = require('crypto');
const logger = require('../../utils/logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes recommended for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes auth tag

/**
 * Validates and retrieves the 32-byte master encryption key
 * @returns {Buffer} 32-byte master key
 */
const getMasterKey = () => {
  const hexKey = process.env.MASTER_ENCRYPTION_KEY;

  if (!hexKey) {
    throw new Error('SECURITY CONFIGURATION ERROR: MASTER_ENCRYPTION_KEY is missing from environment.');
  }

  // Key must be exactly 64 hex characters (32 bytes)
  if (hexKey.length !== 64) {
    throw new Error(
      `SECURITY CONFIGURATION ERROR: MASTER_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Found length: ${hexKey.length}`
    );
  }

  return Buffer.from(hexKey, 'hex');
};

/**
 * Calculates SHA-256 checksum of data buffer for integrity verification
 * @param {Buffer} buffer
 * @returns {string} Hex SHA-256 digest
 */
const calculateHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Encrypts a raw file buffer using AES-256-GCM
 * @param {Buffer} buffer Raw file data
 * @returns {{ encryptedBuffer: Buffer, iv: string, authTag: string, sha256Hash: string, originalSize: number, encryptedSize: number }}
 */
const encryptBuffer = (buffer) => {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  // Compute original file integrity hash
  const sha256Hash = calculateHash(buffer);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encryptedBuffer = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    sha256Hash,
    originalSize: buffer.length,
    encryptedSize: encryptedBuffer.length,
  };
};

/**
 * Decrypts an encrypted file buffer using AES-256-GCM and verifies authenticity tag
 * @param {Buffer} encryptedBuffer Ciphertext buffer
 * @param {string} ivHex Hex string of the IV
 * @param {string} authTagHex Hex string of the Auth Tag
 * @returns {Buffer} Decrypted plaintext buffer
 */
const decryptBuffer = (encryptedBuffer, ivHex, authTagHex) => {
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed: Ciphertext or AuthTag has been tampered with or corrupted.');
    const err = new Error('Decryption failed: Integrity check error or invalid cryptographic key.');
    err.statusCode = 400;
    throw err;
  }
};

/**
 * Encrypts a short string value (e.g. OAuth tokens, secrets) using AES-256-GCM.
 * Returns a JSON string containing { ciphertext, iv, authTag } — all hex-encoded.
 *
 * @param {string} plaintext
 * @returns {string} JSON string safe to store in MongoDB
 */
const encryptField = (plaintext) => {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  });
};

/**
 * Decrypts a string value previously encrypted by encryptField().
 * Input must be the JSON string produced by encryptField().
 *
 * @param {string} encryptedJson
 * @returns {string} Decrypted plaintext string
 */
const decryptField = (encryptedJson) => {
  const { ciphertext, iv, authTag } = JSON.parse(encryptedJson);
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  try {
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    const error = new Error('Field decryption failed: data may be corrupted or tampered with.');
    error.statusCode = 500;
    throw error;
  }
};

module.exports = {
  ALGORITHM,
  getMasterKey,
  calculateHash,
  encryptBuffer,
  decryptBuffer,
  encryptField,
  decryptField,
};

