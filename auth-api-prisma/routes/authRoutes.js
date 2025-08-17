const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const {
  registerValidation,
  loginValidation,
  verifyOtpValidation
} = require('../validators/authValidator');


router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.loginUser);
router.post('/verify-otp', verifyOtpValidation, authController.verifyOtp);

module.exports = router;
