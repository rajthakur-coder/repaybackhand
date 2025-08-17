// validators/authValidator.js
const { body } = require('express-validator');

// OTP length constant
const OTP_LENGTH = 6;

// Register Validation
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&]/).withMessage('Password must contain at least one special character'),

  body('mobile_no')
    .trim()
    .notEmpty().withMessage('Mobile number is required')
    .isLength({ min: 10, max: 10 }).withMessage('Mobile number must be exactly 10 digits')
    .isNumeric().withMessage('Mobile number must contain only digits'),
];

//Login Validation 
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format'),

  body('password')
    .notEmpty().withMessage('Password is required'),

  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude value'),

  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude value'),
];

//Verify OTP Validation 
const verifyOtpValidation = [
  body('tempUserId')
    .notEmpty().withMessage('Temp User ID is required'),

  body('emailOtp')
    .notEmpty().withMessage('Email OTP is required')
    .isNumeric().withMessage('Email OTP must be numeric')
    .isLength({ min: OTP_LENGTH, max: OTP_LENGTH }).withMessage(`Email OTP must be ${OTP_LENGTH} digits`),

  body('mobileOtp')
    .notEmpty().withMessage('Mobile OTP is required')
    .isNumeric().withMessage('Mobile OTP must be numeric')
    .isLength({ min: OTP_LENGTH, max: OTP_LENGTH }).withMessage(`Mobile OTP must be ${OTP_LENGTH} digits`),
];

module.exports = {
  registerValidation,
  loginValidation,
  verifyOtpValidation
};
