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
router.post(
  '/register',
  [
    body('name').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('mobile_no').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, message: errors.array()[0].msg });

    const { name, email, password, mobile_no } = req.body;

    try {
      const existing =
        await prisma.users.findUnique({ where: { email } }) ||
        await prisma.temp_users.findUnique({ where: { email } });

      if (existing)
        return res.status(409).json({ success: false, message: 'Email already registered or pending verification' });

      const hashed = await bcrypt.hash(password, 10);

      //  Generate OTPs
      const emailOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const mobileOtp = Math.floor(100000 + Math.random() * 900000).toString();

     
      await sendOtpRegistration(email, 'email');
      console.log('Generated OTP for Email:', emailOtp);
      console.log('Generated OTP for Mobile:', mobileOtp);

      //  Create temp user with OTPs
      const tempUser = await prisma.temp_users.create({
        data: {
          name,
          email,
          password: hashed,
          mobile_no,
          email_otp: emailOtp,
          mobile_otp: mobileOtp,
          is_mobile_verified: false,
          is_email_verified: false
        }
      });

      return res.status(201).json({
        success: true,
        message: 'OTP sent for email and mobile verification',
        tempUserId: tempUser.id
      });

    } catch (e) {
      console.error(e);
      return res.status(500).json({ success: false, message: 'Server error' });
    } finally {
      await prisma.$disconnect();
    }
  }
);


// Login
router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ success: false, message: errors.array()[0].msg });

    const { email, password, latitude, longitude } = req.body;
    const agent = useragent.parse(req.headers['user-agent']);

    if (agent.isBot) return res.status(400).json({ message: 'Unidentified User Agent' });

    try {
      let user = await prisma.users.findUnique({ where: { email } });
      let tempUser = await prisma.temp_users.findUnique({ where: { email } });

      if (tempUser) {
        if (tempUser.is_mobile_verified !== 1) {
          await Helper.sendOtpRegistration(email, 'mobile');
          return res.status(200).json({ verify: 'mobile', info: Helper.maskMobile(tempUser.mobile_no) });
        }

        if (tempUser.is_email_verified !== 1) {
          await Helper.sendOtpRegistration(email, 'email');
          return res.status(200).json({ verify: 'email', info: Helper.maskEmail(tempUser.email) });
        }

        user = await prisma.users.create({
          data: {
            uuid: Helper.randomUUID(),
            name: tempUser.name,
            email: tempUser.email,
            password: tempUser.password,
            mobile_no: tempUser.mobile_no,
          }
        });

        await prisma.wallets.create({
          data: {
            user_id: user.id,
            balance: 0,
            lien_balance: 0,
            free_balance: 100,
            balance_expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });

        await prisma.temp_users.delete({ where: { id: tempUser.id } });
      }

      if (!user) return res.status(404).json({ message: 'User not found' });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

      if (user.status !== 'active') return res.status(403).json({ message: 'Account not active' });

      const token = jwt.sign(
        {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.status(200).json({
        success: true,
        token,
        user: {
          name: user.name,
          email: user.email,
          role: user.role
        },
        location: { latitude, longitude },
        device: agent.toString()
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    } finally {
      await prisma.$disconnect();
    }
  }
);




router.post('/verify-otp', async (req, res) => {
  const { email, emailOtp, mobileOtp } = req.body;

  if (!email || !emailOtp || !mobileOtp) {
    return res.status(400).json({ message: 'email, emailOtp, and mobileOtp are required' });
  }

  try {
    const tempUser = await prisma.temp_users.findUnique({ where: { email } });

    if (!tempUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isEmailValid = tempUser.email_otp === emailOtp;
    const isMobileValid = tempUser.mobile_otp === mobileOtp;

    if (!isEmailValid || !isMobileValid) {
      return res.status(400).json({ message: 'Invalid OTP(s)' });
    }

    // Insert into users table
    const newUser = await prisma.users.create({
      data: {
        uuid: randomUUID(),
        name: tempUser.name,
        email: tempUser.email,
        mobile_no: tempUser.mobile_no,
        password: tempUser.password,
        status: 'active',
        otp_status: 'verified',
        role: 'user'
      },
    });

    // Create wallet for new user
    await prisma.wallets.create({
      data: {
        user_id: newUser.id,
        balance: 0.0,
        lien_balance: 0.0,
        free_balance: 100.0,
        balance_expire_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), 
      },
    });

    // Remove temp user
    await prisma.temp_users.delete({ where: { email } });

    res.status(200).json({
      success: true,
      message: 'User verified, registered, and wallet created successfully.',
    });
  } catch (err) {
    console.error('OTP verification error:', err);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
});




module.exports = router;
