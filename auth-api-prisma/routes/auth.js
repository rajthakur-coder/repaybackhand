const express = require('express');
const { body, validationResult } = require('express-validator');
const useragent = require('useragent');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { sendOtpRegistration } = require('../utils/helper');
const { randomUUID } = require('../utils/helper');
const jwt = require('jsonwebtoken');





const { generateToken } = require('../utils/jwt');
const Helper = require('../utils/helper');

const router = express.Router();
const prisma = new PrismaClient();

// Register
router.post('/register',
  [
  body('name')
    .notEmpty().withMessage('Name is required'),

  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one digit')
    .matches(/[@$!%*?&]/).withMessage('Password must contain at least one special character'),

  body('mobile_no')
    .notEmpty().withMessage('Mobile number is required')
    .isLength({ min: 10, max: 10 }).withMessage('Mobile number must be exactly 10 digits')
    .matches(/^[0-9]{10}$/).withMessage('Mobile number must contain only digits'),
],

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        statusCode: 2,
        message: errors.array()[0].msg
      });
    }

    const { name, email, password, mobile_no } = req.body;

    try {
      const existing =
        await prisma.users.findUnique({ where: { email } }) ||
        await prisma.temp_users.findUnique({ where: { email } });

      if (existing) {
        return res.status(409).json({
          success: false,
          statusCode: 0,
          message: 'Email already registered or pending verification'
        });
      }

      const hashed = await bcrypt.hash(password, 10);

      const tempUser = await prisma.temp_users.create({
        data: {
          name,
          email,
          password: hashed,
          mobile_no,
          is_mobile_verified: false,
          is_email_verified: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      const emailOtp = await sendOtpRegistration(email, 'email', tempUser.id);
      const mobileOtp = await sendOtpRegistration(mobile_no, 'mobile', tempUser.id);

      await prisma.temp_users.update({
        where: { id: tempUser.id },
        data: {
          email_otp: emailOtp,
          mobile_otp: mobileOtp
        }
      });

      return res.status(201).json({
        success: true,
        statusCode: 1,
        message: 'OTP sent for email and mobile verification',
        tempUserId: tempUser.id
      });

    } catch (err) {
      console.error('Register error:', err);
      return res.status(500).json({
        success: false,
        statusCode: 0,
        message: 'Internal server error'
      });
    } finally {
      await prisma.$disconnect();
    }
  }
);

// Login

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    null
  );
}

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password is required'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        statusCode: 2,
        message: errors.array()[0].msg,
      });
    }

    const { email, password, latitude, longitude } = req.body;
    const agent = useragent.parse(req.headers['user-agent']);
    const ip = getClientIp(req);

    if (agent.isBot) {
      return res.status(400).json({
        success: false,
        statusCode: 0,
        message: 'Unidentified User Agent',
      });
    }

    try {
      let user = await prisma.users.findUnique({ where: { email } });
      const tempUser = await prisma.temp_users.findUnique({ where: { email } });

      if (tempUser) {
        if (tempUser.is_mobile_verified !== 1) {
          await Helper.sendOtpRegistration(tempUser.mobile_no, 'mobile', tempUser.id);
          return res.status(200).json({
            success: false,
            statusCode: 0,
            verify: 'mobile',
            message: 'Mobile verification pending',
            info: Helper.maskMobile(tempUser.mobile_no),
          });
        }

        if (tempUser.is_email_verified !== 1) {
          await Helper.sendOtpRegistration(tempUser.email, 'email', tempUser.id);
          return res.status(200).json({
            success: false,
            statusCode: 0,
            verify: 'email',
            message: 'Email verification pending',
            info: Helper.maskEmail(tempUser.email),
          });
        }

        user = await prisma.users.create({
          data: {
            uuid: randomUUID(),
            name: tempUser.name,
            email: tempUser.email,
            password: tempUser.password,
            mobile_no: tempUser.mobile_no,
            role: 'user',
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        await prisma.wallets.create({
          data: {
            user_id: user.id,
            balance: 0,
            lien_balance: 0,
            free_balance: 100,
            balance_expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        await prisma.temp_users.delete({ where: { id: tempUser.id } });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          statusCode: 0,
          message: 'User not found',
        });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        await prisma.login_history.create({
          data: {
            user_id: user.uuid,
            device: agent.device.toString(),
            operating_system: agent.os.toString(),
            browser: agent.toAgent(),
            ip_address: ip,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            status: 'Failed',
            user_agent: req.headers['user-agent'],
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        return res.status(401).json({
          success: false,
          statusCode: 0,
          message: 'Invalid credentials',
        });
      }

      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          statusCode: 0,
          message: 'Account not active',
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      await prisma.login_history.create({
        data: {
          user_id: user.uuid,
          device: agent.device.toString(),
          operating_system: agent.os.toString(),
          browser: agent.toAgent(),
          ip_address: ip,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          status: 'Success',
          user_agent: req.headers['user-agent'],
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        statusCode: 1,
        token,
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
        },
        location: { latitude, longitude },
        device: agent.toString(),
        message: 'Login successful',
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({
        success: false,
        statusCode: 0,
        message: 'Server error',
      });
    }

    process.on('SIGINT', async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }
);


// Verify OTP
router.post(
  '/verify-otp',
  [
    body('email')
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),

    body('emailOtp')
      .notEmpty().withMessage('Email OTP is required')
      .isNumeric().withMessage('Email OTP must be a number')
      .isLength({ min: 6, max: 6 }).withMessage('Email OTP must be 6 digits'),

    body('mobileOtp')
      .notEmpty().withMessage('Mobile OTP is required')
      .isNumeric().withMessage('Mobile OTP must be a number')
      .isLength({ min: 6, max: 6 }).withMessage('Mobile OTP must be 6 digits'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        statusCode: 2,
        message: errors.array()[0].msg
      });
    }

    const { email, emailOtp, mobileOtp } = req.body;

    try {
      const tempUser = await prisma.temp_users.findUnique({ where: { email } });
      if (!tempUser) {
        return res.status(404).json({
          success: false,
          statusCode: 0,
          message: 'Temporary user not found'
        });
      }

      const now = new Date();
      const otpRecords = await prisma.otp_verifications.findMany({
        where: {
          user_id: tempUser.id,
          is_verified: false,
          expires_at: { gt: now }
        }
      });

      const emailOtpRecord = otpRecords.find(otp => otp.otp === parseInt(emailOtp));
      const mobileOtpRecord = otpRecords.find(otp => otp.otp === parseInt(mobileOtp));

      if (!emailOtpRecord || !mobileOtpRecord) {
        return res.status(400).json({
          success: false,
          statusCode: 0,
          message: 'Invalid or expired OTP(s)'
        });
      }

      await prisma.otp_verifications.updateMany({
        where: {
          id: { in: [emailOtpRecord.id, mobileOtpRecord.id] }
        },
        data: { is_verified: true }
      });

      const newUser = await prisma.users.create({
        data: {
          uuid: randomUUID(),
          name: tempUser.name,
          email: tempUser.email,
          mobile_no: tempUser.mobile_no,
          password: tempUser.password,
          status: 'active',
          otp_status: 'verified',
          role: 'user',
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      await prisma.wallets.create({
        data: {
          user_id: newUser.id,
          balance: 0.0,
          lien_balance: 0.0,
          free_balance: 100.0,
          balance_expire_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      await prisma.temp_users.delete({ where: { id: tempUser.id } });

      return res.status(200).json({
        success: true,
        statusCode: 1,
        message: 'User verified, registered, and wallet created successfully'
      });

    } catch (err) {
      console.error('OTP verification error:', err);
      return res.status(500).json({
        success: false,
        statusCode: 0,
        message: 'Internal server error'
      });
    } finally {
      await prisma.$disconnect();
    }
  }
);


module.exports = router;
