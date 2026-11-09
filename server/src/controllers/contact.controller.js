const contactService = require('../services/contact/contact.service');

/**
 * Register emergency contact
 * @route POST /api/contacts
 */
const createContactHandler = async (req, res, next) => {
  try {
    const result = await contactService.createContact(req.user._id, req.body);

    res.status(201).json({
      success: true,
      message: 'Emergency contact registered. Verification link dispatched.',
      data: result.contact,
      ...(process.env.NODE_ENV !== 'production' ? { devVerificationLink: result.verificationLink } : {}),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List contacts for current operator
 * @route GET /api/contacts
 */
const listContactsHandler = async (req, res, next) => {
  try {
    const contacts = await contactService.getUserContacts(req.user._id);

    res.status(200).json({
      success: true,
      count: contacts.length,
      data: contacts,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single contact
 * @route GET /api/contacts/:id
 */
const getContactHandler = async (req, res, next) => {
  try {
    const contact = await contactService.getContactById(req.user._id, req.params.id);

    res.status(200).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update contact
 * @route PUT /api/contacts/:id
 */
const updateContactHandler = async (req, res, next) => {
  try {
    const contact = await contactService.updateContact(req.user._id, req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: 'Contact details updated successfully.',
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete contact
 * @route DELETE /api/contacts/:id
 */
const deleteContactHandler = async (req, res, next) => {
  try {
    const result = await contactService.deleteContact(req.user._id, req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public recipient verification callback
 * @route GET /api/contacts/verify/:token
 */
const verifyTokenHandler = async (req, res, next) => {
  try {
    const result = await contactService.verifyContactToken(req.params.token);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.contact,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign evidence items to contact
 * @route POST /api/contacts/:id/assign-evidence
 */
const assignEvidenceHandler = async (req, res, next) => {
  try {
    const contact = await contactService.assignEvidenceToContact(
      req.user._id,
      req.params.id,
      req.body.evidenceIds || []
    );

    res.status(200).json({
      success: true,
      message: 'Evidence authorization mapping updated successfully.',
      data: contact,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend verification token
 * @route POST /api/contacts/:id/resend-verification
 */
const resendTokenHandler = async (req, res, next) => {
  try {
    const result = await contactService.resendVerificationToken(req.user._id, req.params.id);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createContactHandler,
  listContactsHandler,
  getContactHandler,
  updateContactHandler,
  deleteContactHandler,
  verifyTokenHandler,
  assignEvidenceHandler,
  resendTokenHandler,
};

