const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const createContactSchema = z.object({
  name: z
    .string({ required_error: 'Contact name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z
    .string({ required_error: 'Contact email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address format'),
  relationship: z.string().trim().max(50).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
  authorizedEvidence: z
    .array(z.string().regex(objectIdRegex, 'Invalid Evidence ObjectId'))
    .optional(),
});

const updateContactSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  relationship: z.string().trim().max(50).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
});

const assignEvidenceSchema = z.object({
  evidenceIds: z.array(z.string().regex(objectIdRegex, 'Invalid Evidence ObjectId')),
});

module.exports = {
  createContactSchema,
  updateContactSchema,
  assignEvidenceSchema,
};

