const express = require('express');
const { body, validationResult } = require('express-validator');
const useragent = require('useragent');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const { sendOtpRegistration } = require('../utils/helper');
const { randomUUID } = require('../utils/helper');
const jwt = require('jsonwebtoken');
// const { randomUUID } = require('crypto');





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

      // 1. Create temp user first
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

      // 2. Generate and save OTPs after tempUser created
      const emailOtp = await sendOtpRegistration(email, 'email', tempUser.id);
      const mobileOtp = await sendOtpRegistration(mobile_no, 'mobile', tempUser.id);

      // 3. Update OTPs in temp_users table
      await prisma.temp_users.update({
        where: { id: tempUser.id },
        data: {
          email_otp: emailOtp,
          mobile_otp: mobileOtp
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
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, message: errors.array()[0].msg });

    const { email, password, latitude, longitude } = req.body;
    const agent = useragent.parse(req.headers['user-agent']);
    const ip = getClientIp(req);

    if (agent.isBot) return res.status(400).json({ message: 'Unidentified User Agent' });

    try {
      let user = await prisma.users.findUnique({ where: { email } });
      const tempUser = await prisma.temp_users.findUnique({ where: { email } });

      // If temp user exists
      if (tempUser) {
        if (tempUser.is_mobile_verified !== 1) {
          // await Helper.sendOtpRegistration(email, 'mobile');
          await Helper.sendOtpRegistration(mobile_no, 'mobile', tempUser.id);
          return res.status(200).json({ verify: 'mobile', info: Helper.maskMobile(tempUser.mobile_no) });
        }

        if (tempUser.is_email_verified !== 1) {
          // await Helper.sendOtpRegistration(email, 'email');
          await Helper.sendOtpRegistration(email, 'email', tempUser.id);

          return res.status(200).json({ verify: 'email', info: Helper.maskEmail(tempUser.email) });
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
            updated_at: new Date()
          }
        });

        await prisma.wallets.create({
          data: {
            user_id: user.id,
            balance: 0,
            lien_balance: 0,
            free_balance: 100,
            balance_expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        await prisma.temp_users.delete({ where: { id: tempUser.id } });
      }

      if (!user) return res.status(404).json({ message: 'User not found' });

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
            updated_at: new Date()
          }
        });
        return res.status(401).json({ message: 'Invalid credentials' });
      }

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
          updated_at: new Date()
        }
      });

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
      console.error('Login error:', err);
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
    // 1. Find temp user
    const tempUser = await prisma.temp_users.findUnique({ where: { email } });
    if (!tempUser) {
      return res.status(404).json({ message: 'Temporary user not found' });
    }

    const tempUserId = tempUser.id;

    // 2. Fetch valid OTP records from otp_verifications table
    const now = new Date();
    const otpRecords = await prisma.otp_verifications.findMany({
      where: {
        user_id: tempUserId,
        is_verified: false,
        expires_at: { gt: now }
      }
    });

    const emailOtpRecord = otpRecords.find(otp => otp.otp === parseInt(emailOtp));
    const mobileOtpRecord = otpRecords.find(otp => otp.otp === parseInt(mobileOtp));


    if (!emailOtpRecord || !mobileOtpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP(s)' });
    }

    // 3. Mark OTPs as verified
    await prisma.otp_verifications.updateMany({
      where: {
        id: { in: [emailOtpRecord.id, mobileOtpRecord.id] }
      },
      data: { is_verified: true }
    });

    // 4. Move data to users table
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

    // 5. Create wallet
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

    // 6. Delete temp user
    await prisma.temp_users.delete({ where: { id: tempUserId } });

    return res.status(200).json({
      success: true,
      message: 'User verified, registered, and wallet created successfully.'
    });

  } catch (err) {
    console.error('OTP verification error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
});



module.exports = router;
