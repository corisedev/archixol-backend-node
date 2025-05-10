const { body, validationResult } = require('express-validator');

// Validate signup request
exports.validateSignup = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('user_type').isIn(['supplier', 'service_provider', 'client']).withMessage('Invalid user type'),
  body('agree_terms').equals('true').withMessage('You must agree to terms and conditions')
];

// Validate login request
exports.validateLogin = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

// Validate forgot password request
exports.validateForgotPassword = [
  body('email').isEmail().withMessage('Please provide a valid email')
];

// Validate reset password request
exports.validateResetPassword = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  })
];

// Validate results helper
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};