const { z } = require('zod');

/**
 * Validator for send test email endpoint
 */
const sendTestEmailSchema = z.object({
  recipientEmail: z
    .string()
    .email('Invalid recipient email address')
    .toLowerCase()
    .trim(),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject cannot exceed 200 characters')
    .trim()
    .optional(),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(5000, 'Message cannot exceed 5000 characters')
    .trim()
    .optional(),
});

module.exports = { sendTestEmailSchema };

