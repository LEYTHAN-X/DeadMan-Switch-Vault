const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const logger = require('../../utils/logger');

/**
 * Generate signed JSON Web Token
 * @param {string} userId
 * @returns {string} Signed JWT
 */
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_dead_man_switch_vault_2026_secure';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ id: userId }, secret, { expiresIn });
};

/**
 * Calculate next check-in deadline based on schedule config
 * @param {object} schedule
 * @returns {Date}
 */
const calculateNextCheckIn = (schedule = {}) => {
  const now = new Date();
  const type = schedule.intervalType || 'daily';

  if (type === 'daily') {
    now.setDate(now.getDate() + 1);
  } else if (type === 'weekly') {
    now.setDate(now.getDate() + 7);
  } else if (type === 'custom') {
    const days = schedule.customIntervalDays || 1;
    now.setDate(now.getDate() + days);
  }

  // Adjust to designated reminder hour UTC if configured
  if (schedule.reminderHourUTC !== undefined) {
    now.setUTCHours(schedule.reminderHourUTC, 0, 0, 0);
  }

  return now;
};

/**
 * Register a new user account
 * @param {object} userData
 */
const registerUser = async ({ fullName, email, password, checkInSchedule }) => {
  // Check if email already registered
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const error = new Error('An account with this email address already exists');
    error.statusCode = 409;
    throw error;
  }

  // Calculate initial check-in deadline
  const nextCheckInAt = calculateNextCheckIn(checkInSchedule);

  const user = await User.create({
    fullName,
    email: email.toLowerCase(),
    password,
    checkInSchedule: checkInSchedule || { intervalType: 'daily', customIntervalDays: 1, reminderHourUTC: 9 },
    lastCheckIn: new Date(),
    nextCheckInAt,
  });

  const token = generateToken(user._id);

  logger.info(`New user registered: ${user._id} (${user.email})`);

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      checkInSchedule: user.checkInSchedule,
      lastCheckIn: user.lastCheckIn,
      nextCheckInAt: user.nextCheckInAt,
      createdAt: user.createdAt,
    },
    token,
  };
};

/**
 * Authenticate user with credentials & brute-force protection
 * @param {object} credentials
 */
const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Check account lockout
  if (user.isLocked()) {
    const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
    const error = new Error(
      `Account is temporarily locked due to excessive failed attempts. Please retry in ${remainingMinutes} minute(s).`
    );
    error.statusCode = 423; // Locked
    throw error;
  }

  // Verify password
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    await user.handleFailedLogin();
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Reset failed login attempts on successful authentication
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    await user.resetLoginAttempts();
  }

  const token = generateToken(user._id);

  logger.info(`User logged in successfully: ${user._id} (${user.email})`);

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      checkInSchedule: user.checkInSchedule,
      lastCheckIn: user.lastCheckIn,
      nextCheckInAt: user.nextCheckInAt,
      createdAt: user.createdAt,
    },
    token,
  };
};

/**
 * Fetch profile details for authenticated user
 * @param {string} userId
 */
const getUserProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User profile not found');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    checkInSchedule: user.checkInSchedule,
    lastCheckIn: user.lastCheckIn,
    nextCheckInAt: user.nextCheckInAt,
    createdAt: user.createdAt,
  };
};

/**
 * Generate password reset token
 * @param {string} email
 */
const generatePasswordResetToken = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    // Return gracefully to prevent email enumeration
    return { token: null, user: null };
  }

  // Generate 32-byte cryptographic random token
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token before storing in database
  user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity

  await user.save();

  logger.info(`Password reset token generated for user: ${user._id}`);

  return { token: resetToken, user };
};

/**
 * Reset password using valid token
 * @param {string} rawToken
 * @param {string} newPassword
 */
const resetPassword = async (rawToken, newPassword) => {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    const error = new Error('Password reset token is invalid or has expired');
    error.statusCode = 400;
    throw error;
  }

  // Update password and clear reset token
  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;

  await user.save();

  const token = generateToken(user._id);

  logger.info(`Password successfully reset for user: ${user._id}`);

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    token,
  };
};

/**
 * Manual user check-in
 * Updates lastCheckIn and recalculates nextCheckInAt
 * @param {string} userId
 */
const checkInUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const now = new Date();
  const nextCheckIn = calculateNextCheckIn(user.checkInSchedule);

  user.lastCheckIn = now;
  user.nextCheckInAt = nextCheckIn;
  user.status = 'ACTIVE'; // Ensure status is active

  await user.save();
  logger.info(`Manual check-in completed by user ${user._id} (${user.email})`);

  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    checkInSchedule: user.checkInSchedule,
    lastCheckIn: user.lastCheckIn,
    nextCheckInAt: user.nextCheckInAt,
  };
};

/**
 * Update operator profile
 */
const updateProfile = async (userId, { fullName }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  if (fullName) user.fullName = fullName.trim();
  await user.save();
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
  };
};

/**
 * Change operator password with current password verification
 */
const changePassword = async (userId, currentPassword, newPassword, ipAddress = 'unknown') => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 400;
    throw error;
  }

  user.password = newPassword;
  await user.save();

  const AuditLog = require('../../models/AuditLog');
  await AuditLog.create({
    userId,
    action: 'PASSWORD_RESET_COMPLETED',
    metadata: { method: 'SETTINGS_CHANGE_PASSWORD' },
    ipAddress,
  });

  return { success: true, message: 'Password changed successfully' };
};

module.exports = {
  generateToken,
  calculateNextCheckIn,
  registerUser,
  loginUser,
  getUserProfile,
  checkInUser,
  generatePasswordResetToken,
  resetPassword,
  updateProfile,
  changePassword,
};

