const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never return password hash in queries unless explicitly requested
    },
    status: {
      type: String,
      enum: [
        'ACTIVE',
        'CHECK_IN_OVERDUE',
        'WARNING',
        'GRACE_PERIOD',
        'ADDITIONAL_VERIFICATION',
        'MANUAL_OR_PREAUTHORIZED_RELEASE_APPROVAL',
        'AUTHORIZED_RELEASE',
        'SUSPENDED',
      ],
      default: 'ACTIVE',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    checkInSchedule: {
      intervalType: {
        type: String,
        enum: ['daily', 'weekly', 'custom', 'minutes', 'hours'],
        default: 'daily',
      },
      customIntervalMinutes: {
        type: Number,
        default: 1440,
        min: 1,
        max: 525600, // Up to 1 year in minutes
      },
      customIntervalDays: {
        type: Number,
        default: 1,
        min: 1,
        max: 365,
      },
      customIntervalHours: {
        type: Number,
        default: 24,
        min: 0.01,
        max: 8760,
      },
      gracePeriodMinutes: {
        type: Number,
        default: 120, // Default 2 hours in minutes
        min: 1,
        max: 10080, // Up to 7 days in minutes
      },
      gracePeriodHours: {
        type: Number,
        default: 2,
        min: 0.01,
        max: 168,
      },
      reminderOffsetsHours: {
        type: [Number],
        default: [6, 2],
      },
      reminderHourUTC: {
        type: Number,
        default: 9,
        min: 0,
        max: 23,
      },
    },
    lastCheckIn: {
      type: Date,
      default: Date.now,
    },
    nextCheckInAt: {
      type: Date,
      default: () => {
        const next = new Date();
        next.setDate(next.getDate() + 1); // Default to 24 hours from creation
        return next;
      },
    },
    warningSentAt: {
      type: Date,
      default: null,
    },
    gracePeriodExpiresAt: {
      type: Date,
      default: null,
    },
    checkInCount: {
      type: Number,
      default: 0,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
userSchema.methods.comparePassword = userSchema.methods.matchPassword;

// Check if account is currently locked due to failed attempts
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment failed attempts and lock account if threshold exceeded (5 attempts = 15 min lock)
userSchema.methods.handleFailedLogin = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

  this.failedLoginAttempts += 1;

  if (this.failedLoginAttempts >= MAX_ATTEMPTS && !this.isLocked()) {
    this.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
  }

  return await this.save();
};

// Reset failed attempts upon successful login
userSchema.methods.resetLoginAttempts = async function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
  return await this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;

