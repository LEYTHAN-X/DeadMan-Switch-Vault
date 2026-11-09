const EmergencyContact = require('../../models/EmergencyContact');
const Evidence = require('../../models/Evidence');
const logger = require('../../utils/logger');

/**
 * Register a new emergency recipient
 */
const createContact = async (userId, data) => {
  const email = data.email.toLowerCase();

  // Check for duplicate contact email under this operator
  const existing = await EmergencyContact.findOne({ user: userId, email });
  if (existing) {
    const error = new Error('You have already added an emergency contact with this email address.');
    error.statusCode = 409;
    throw error;
  }

  // Validate authorized evidence ownership if provided
  if (data.authorizedEvidence && data.authorizedEvidence.length > 0) {
    const validCount = await Evidence.countDocuments({
      _id: { $in: data.authorizedEvidence },
      user: userId,
    });
    if (validCount !== data.authorizedEvidence.length) {
      const error = new Error('Security Error: One or more selected evidence files do not belong to your vault.');
      error.statusCode = 403;
      throw error;
    }
  }

  const contact = new EmergencyContact({
    user: userId,
    name: data.name.trim(),
    email,
    relationship: data.relationship?.trim() || 'Trusted Contact',
    phoneNumber: data.phoneNumber?.trim() || '',
    notes: data.notes?.trim() || '',
    authorizedEvidence: data.authorizedEvidence || [],
  });

  const verificationToken = contact.generateVerificationToken();
  await contact.save();

  logger.info(`Emergency contact added: ${contact._id} (${contact.email}) for operator ${userId}`);

  const verificationLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/contacts/verify/${verificationToken}`;

  return {
    contact,
    verificationToken,
    verificationLink,
  };
};

/**
 * Retrieve all emergency contacts for an operator
 */
const getUserContacts = async (userId) => {
  const contacts = await EmergencyContact.find({ user: userId })
    .populate('authorizedEvidence', 'title originalFilename mimeType fileCategory originalSize')
    .sort({ createdAt: -1 });

  return contacts;
};

/**
 * Retrieve specific contact details with ownership guard
 */
const getContactById = async (userId, contactId) => {
  const contact = await EmergencyContact.findById(contactId).populate(
    'authorizedEvidence',
    'title originalFilename mimeType fileCategory originalSize'
  );

  if (!contact) {
    const error = new Error('Emergency contact not found.');
    error.statusCode = 404;
    throw error;
  }

  if (contact.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: You are not authorized to view this contact.');
    error.statusCode = 403;
    throw error;
  }

  return contact;
};

/**
 * Update contact details
 */
const updateContact = async (userId, contactId, updateData) => {
  const contact = await EmergencyContact.findById(contactId);

  if (!contact) {
    const error = new Error('Emergency contact not found.');
    error.statusCode = 404;
    throw error;
  }

  if (contact.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: You are not authorized to update this contact.');
    error.statusCode = 403;
    throw error;
  }

  // If email is changing, ensure uniqueness and re-require verification
  if (updateData.email && updateData.email.toLowerCase() !== contact.email) {
    const newEmail = updateData.email.toLowerCase();
    const existing = await EmergencyContact.findOne({ user: userId, email: newEmail });
    if (existing) {
      const error = new Error('An emergency contact with this email already exists in your vault.');
      error.statusCode = 409;
      throw error;
    }
    contact.email = newEmail;
    contact.generateVerificationToken();
  }

  if (updateData.name) contact.name = updateData.name.trim();
  if (updateData.relationship) contact.relationship = updateData.relationship.trim();
  if (updateData.phoneNumber !== undefined) contact.phoneNumber = updateData.phoneNumber.trim();
  if (updateData.notes !== undefined) contact.notes = updateData.notes.trim();

  await contact.save();
  logger.info(`Contact updated: ${contact._id} by user ${userId}`);

  return contact;
};

/**
 * Remove an emergency contact
 */
const deleteContact = async (userId, contactId) => {
  const contact = await EmergencyContact.findById(contactId);

  if (!contact) {
    const error = new Error('Emergency contact not found.');
    error.statusCode = 404;
    throw error;
  }

  if (contact.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: You are not authorized to delete this contact.');
    error.statusCode = 403;
    throw error;
  }

  await EmergencyContact.findByIdAndDelete(contactId);
  logger.info(`Emergency contact deleted: ${contactId} by operator ${userId}`);

  return { success: true, message: 'Emergency contact successfully removed.' };
};

/**
 * Public recipient verification callback
 */
const verifyContactToken = async (token) => {
  const contact = await EmergencyContact.findOne({
    verificationToken: token,
    verificationExpires: { $gt: new Date() },
  });

  if (!contact) {
    const error = new Error('Verification token is invalid, expired, or has already been used.');
    error.statusCode = 400;
    throw error;
  }

  contact.verificationStatus = 'VERIFIED';
  contact.verifiedAt = new Date();
  contact.verificationToken = undefined;
  contact.verificationExpires = undefined;

  await contact.save();
  logger.info(`Emergency contact successfully verified: ${contact._id} (${contact.email})`);

  return {
    success: true,
    message: 'Recipient email address verified successfully. Authorization status: VERIFIED.',
    contact: {
      name: contact.name,
      email: contact.email,
      verifiedAt: contact.verifiedAt,
    },
  };
};

/**
 * Assign specific evidence files to a recipient with strict ownership verification
 */
const assignEvidenceToContact = async (userId, contactId, evidenceIds) => {
  const contact = await EmergencyContact.findById(contactId);

  if (!contact) {
    const error = new Error('Emergency contact not found.');
    error.statusCode = 404;
    throw error;
  }

  if (contact.user.toString() !== userId.toString()) {
    const error = new Error('Access denied: Unauthorized contact access.');
    error.statusCode = 403;
    throw error;
  }

  // IDOR Protection: Verify all evidenceIds belong to the requesting operator
  if (evidenceIds.length > 0) {
    const count = await Evidence.countDocuments({
      _id: { $in: evidenceIds },
      user: userId,
    });

    if (count !== evidenceIds.length) {
      const error = new Error('Security Error: One or more evidence files do not belong to your vault.');
      error.statusCode = 403;
      throw error;
    }
  }

  contact.authorizedEvidence = evidenceIds;
  await contact.save();

  logger.info(`Assigned ${evidenceIds.length} evidence items to contact ${contactId}`);

  return await EmergencyContact.findById(contactId).populate(
    'authorizedEvidence',
    'title originalFilename mimeType fileCategory originalSize'
  );
};

/**
 * Resend verification token
 */
const resendVerificationToken = async (userId, contactId) => {
  const contact = await EmergencyContact.findById(contactId);

  if (!contact) {
    const error = new Error('Emergency contact not found.');
    error.statusCode = 404;
    throw error;
  }

  if (contact.user.toString() !== userId.toString()) {
    const error = new Error('Access denied.');
    error.statusCode = 403;
    throw error;
  }

  if (contact.verificationStatus === 'VERIFIED') {
    return {
      alreadyVerified: true,
      message: 'This contact is already verified.',
    };
  }

  const token = contact.generateVerificationToken();
  await contact.save();

  const verificationLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/contacts/verify/${token}`;

  return {
    token,
    verificationLink,
    message: 'New verification token generated successfully.',
  };
};

module.exports = {
  createContact,
  getUserContacts,
  getContactById,
  updateContact,
  deleteContact,
  verifyContactToken,
  assignEvidenceToContact,
  resendVerificationToken,
};

