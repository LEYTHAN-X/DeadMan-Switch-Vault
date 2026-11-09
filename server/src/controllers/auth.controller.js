const authService = require('../services/auth/auth.service');

// Helper to configure secure cookie
const sendTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
  };

  res.cookie('token', token, cookieOptions);
};

/**
 * Register User
 * @route POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { user, token } = await authService.registerUser(req.body);
    sendTokenCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticate User
 * @route POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { user, token } = await authService.loginUser(req.body);
    sendTokenCookie(res, token);

    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log Out User
 * @route POST /api/auth/logout
 */
const logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully',
  });
};

/**
 * Get current authenticated user profile
 * @route GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const profile = await authService.getUserProfile(req.user._id);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset token
 * @route POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { token, user } = await authService.generatePasswordResetToken(req.body.email);

    // In a production setup, dispatch email via notification service.
    // For privacy, return generic response so email existence isn't leaked.
    res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been issued.',
      ...(process.env.NODE_ENV !== 'production' && token ? { devToken: token } : {}),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password using token
 * @route POST /api/auth/reset-password/:token
 */
const resetPassword = async (req, res, next) => {
  try {
    const { user, token } = await authService.resetPassword(req.params.token, req.body.password);
    sendTokenCookie(res, token);

    res.status(200).json({
      success: true,
      message: 'Password has been successfully updated',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manual Check-in Handler
 * @route POST /api/auth/checkin
 */
const checkIn = async (req, res, next) => {
  try {
    const updatedProfile = await authService.checkInUser(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Check-in confirmed successfully. Dead man switch timer reset.',
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Profile
 * @route PUT /api/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const updated = await authService.updateProfile(req.user._id, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change Password
 * @route PUT /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      const err = new Error('Both current password and new password are required');
      err.statusCode = 400;
      throw err;
    }
    if (newPassword.length < 8) {
      const err = new Error('New password must be at least 8 characters');
      err.statusCode = 400;
      throw err;
    }

    const result = await authService.changePassword(
      req.user._id,
      currentPassword,
      newPassword,
      req.ip
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  checkIn,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
};

