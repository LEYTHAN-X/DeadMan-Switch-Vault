const mongoose = require('mongoose');
const crypto = require('crypto');

const emergencyContactSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Operator user reference is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid recipient email address',
      ],
    },
    relationship: {
      type: String,
      trim: true,
      default: 'Trusted Contact',
      maxlength: [50, 'Relationship cannot exceed 50 characters'],
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REVOKED'],
      default: 'PENDING',
      index: true,
    },
    verificationToken: {
      type: String,
      index: true,
    },
    verificationExpires: {
      type: Date,
    },
    verifiedAt: {
      type: Date,
    },
    authorizedEvidence: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evidence',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate contact email under the same operator account
emergencyContactSchema.index({ user: 1, email: 1 }, { unique: true });

// Helper method to generate a new verification token
emergencyContactSchema.methods.generateVerificationToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken = token;
  this.verificationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours validity
  this.verificationStatus = 'PENDING';
  return token;
};

const EmergencyContact = mongoose.model('EmergencyContact', emergencyContactSchema);

module.exports = EmergencyContact;

