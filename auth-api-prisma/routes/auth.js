const express = require('express');
const router = express.Router();
const authController  = require('../controllers/authController');
const { body } = require('express-validator');


router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('At least 6 characters')
    .matches(/[a-z]/).withMessage('At least one lowercase letter')
    .matches(/[A-Z]/).withMessage('At least one uppercase letter')
    .matches(/[0-9]/).withMessage('At least one number')
    .matches(/[@$!%*?&]/).withMessage('At least one special character'),
  body('mobile_no')
    .notEmpty().withMessage('Mobile number is required')
    .isLength({ min: 10, max: 10 }).withMessage('Must be 10 digits')
    .matches(/^[0-9]{10}$/).withMessage('Only numbers allowed')
],
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  authController.loginUser
);


router.post(
  '/verify-otp',
  [
    body('tempUserId').notEmpty().withMessage('Temp User ID is required'),
    body('emailOtp').notEmpty().withMessage('Email OTP is required')
      .isNumeric().withMessage('Email OTP must be a number')
      .isLength({ min: 6, max: 6 }).withMessage('Email OTP must be 6 digits'),
    body('mobileOtp').notEmpty().withMessage('Mobile OTP is required')
      .isNumeric().withMessage('Mobile OTP must be a number')
      .isLength({ min: 6, max: 6 }).withMessage('Mobile OTP must be 6 digits'),
  ],
  authController.verifyOtp
);
module.exports = router;
