const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { protect } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate');
const { verificationLimiter } = require('../middleware/rateLimit.middleware');
const {
  createContactSchema,
  updateContactSchema,
  assignEvidenceSchema,
} = require('../validators/contact.validator');

/**
 * Public Route: Recipient email verification callback (with rate limiting)
 */
router.get('/verify/:token', verificationLimiter, contactController.verifyTokenHandler);

/**
 * Protected Routes: Operator contact management
 */
router.use(protect);

router.post('/', validate(createContactSchema), contactController.createContactHandler);
router.get('/', contactController.listContactsHandler);
router.get('/:id', contactController.getContactHandler);
router.put('/:id', validate(updateContactSchema), contactController.updateContactHandler);
router.delete('/:id', contactController.deleteContactHandler);
router.post(
  '/:id/assign-evidence',
  validate(assignEvidenceSchema),
  contactController.assignEvidenceHandler
);
router.post('/:id/resend-verification', contactController.resendTokenHandler);

module.exports = router;

