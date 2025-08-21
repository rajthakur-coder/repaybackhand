const express = require('express');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require("dayjs");


const { generateToken, verifyToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');

const {
  randomUUID,
  maskEmail,
  maskMobile,
  sendOtpRegistration,
  getClientIp,
  useragent,
  RESPONSE_CODES,
} = require('../utils/helper');

/**
 * REGISTER
 * - Creates temp user
 * - Sends OTPs (email + mobile) via sendOtpRegistration (which should write to otp_verifications)
 * - Returns a temp token for OTP verification
 */
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const { name, email, password, mobile_no } = req.body;

  try {
    const existingUser = await prisma.users.findUnique({ where: { email } });
    const existingTemp = await prisma.temp_users.findUnique({ where: { email } });

    if (existingUser || existingTemp) {
      return error(
        res,
        'Email already registered or pending verification',
        RESPONSE_CODES.DUPLICATE,
        409
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    const now = new Date();
    const tempUser = await prisma.temp_users.create({
      data: {
        name,
        email,
        password: hashed,
        mobile_no,
        is_mobile_verified: false,
        is_email_verified: false,
        created_at: now,
        updated_at: now,
      },
    });

    await sendOtpRegistration(email, 'email', tempUser.id);
    await sendOtpRegistration(mobile_no, 'mobile', tempUser.id);

    const tempUserToken = generateToken({ id: tempUser.id, email: tempUser.email });

    return success(res, 'OTP sent for email and mobile verification', {
      tempUserId: tempUserToken,
      Email: maskEmail(tempUser.email),
      Mobile: maskMobile(tempUser.mobile_no),
    });
  } catch (err) {
    console.error('Register error:', err);
    return error(res, 'Internal server error', RESPONSE_CODES.FAILED, 500);
  }
};

/**
 * LOGIN
 * - If temp user exists and verification pending → resend OTP and return pending state
 * - If temp user verified but not migrated yet → migrate to users + wallet, then continue
 * - Validate password, record login history, return token
 */
// 



exports.loginUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const { email, password, latitude, longitude } = req.body;
  const agent = useragent.parse(req.headers["user-agent"] || "");
  const ip = getClientIp(req);

  if (agent.isBot) {
    return error(res, "Unidentified User Agent", RESPONSE_CODES.FAILED, 400);
  }

  try {
    let user = await prisma.users.findUnique({ where: { email } });
    const tempUser = await prisma.temp_users.findUnique({ where: { email } });

    if (tempUser) {
      if (!tempUser.is_mobile_verified) {
        await sendOtpRegistration(tempUser.mobile_no, "mobile", tempUser.id);
        return success(res, "Mobile verification pending", {
          verify: "mobile",
          info: maskMobile(tempUser.mobile_no),
          statusCode: RESPONSE_CODES.VERIFICATION_PENDING,
        });
      }

      if (!tempUser.is_email_verified) {
        await sendOtpRegistration(tempUser.email, "email", tempUser.id);
        return success(res, "Email verification pending", {
          verify: "email",
          info: maskEmail(tempUser.email),
          statusCode: RESPONSE_CODES.VERIFICATION_PENDING,
        });
      }

      if (!user) {
        const now = new Date();
        user = await prisma.users.create({
          data: {
            uuid: randomUUID(),
            name: tempUser.name,
            email: tempUser.email,
            password: tempUser.password,
            mobile_no: tempUser.mobile_no,
            role: tempUser.role,
            status: "active",
            otp_status: "verified",
            created_at: now,
            updated_at: now,
          },
        });

        await prisma.wallets.create({
          data: {
            user_id: user.id,
            balance: 0,
            lien_balance: 0,
            free_balance: 100,
            balance_expire_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            created_at: now,
            updated_at: now,
          },
        });

        await prisma.temp_users.delete({ where: { id: tempUser.id } });
      }
    }

    if (!user) {
      return error(res, "Invalid email address", RESPONSE_CODES.NOT_FOUND, 401);
    }

    const valid = await bcrypt.compare(password, user.password);

    const historyBase = {
      user_id: user.uuid,
      device: agent.device?.toString?.() || String(agent.device || ""),
      operating_system: agent.os?.toString?.() || String(agent.os || ""),
      browser: agent.toAgent ? agent.toAgent() : "",
      ip_address: ip,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      user_agent: req.headers["user-agent"] || "",
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (!valid) {
      await prisma.login_history.create({
        data: { ...historyBase, status: "Failed" },
      });
      return error(res, "Incorrect password", RESPONSE_CODES.FAILED, 401);
    }

    const allowedRoles = ["user", "admin"];
    if (!allowedRoles.includes(user.role)) {
      return error(res, "Unauthorized role", RESPONSE_CODES.FAILED, 403);
    }

    if (user.status !== "active") {
      return error(res, "Account not active", RESPONSE_CODES.FAILED, 403);
    }

    const tokenPayload = { id: user.id, uuid: user.uuid, email: user.email, role: user.role };
    const token = generateToken(tokenPayload);
    const expiresAt = dayjs().add(1, "hour").toDate();

    await prisma.user_tokens.create({
      data: {
        user_id: user.id, 
        token,
        token_type: "app",
        expires_at: expiresAt,
        status: "active",
        created_at: new Date(),
      },
    });

    await prisma.login_history.create({
      data: { ...historyBase, status: "Success" },
    });

    // 8 Return response
    return res.status(200).json({
      success: true,
      statusCode: 1,
      token,
      expires_at: expiresAt,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
      location: { latitude, longitude },
      device: agent.toString ? agent.toString() : "",
      message: "Login successful",
    });
  } catch (err) {
    console.error("Login error:", err);
    return error(res, "Server error", RESPONSE_CODES.FAILED, 500);
  }
};






/**
 * VERIFY OTP
 * - Validates both email and mobile OTPs (using otp_verifications)
 * - Marks them verified, creates user + wallet, deletes temp user
 */
exports.verifyOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const { tempUserId, emailOtp, mobileOtp } = req.body;

  if (!tempUserId || !emailOtp || !mobileOtp) {
    return error(res, 'tempUserId, emailOtp and mobileOtp are required', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const now = new Date();

  try {
    const decoded = verifyToken(tempUserId);
    if (!decoded || !decoded.email || !decoded.id) {
      return error(res, 'Invalid or expired temp user token', RESPONSE_CODES.FAILED, 400);
    }

    const id = decoded.id;
    const tempUser = await prisma.temp_users.findUnique({ where: { id } });

    if (!tempUser) {
      const alreadyRegistered = await prisma.users.findUnique({ where: { email: decoded.email } });
      if (alreadyRegistered) {
        return success(res, 'User already verified');
      }
      return error(res, 'Temporary user not found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    const emailOtpRecord = await prisma.otp_verifications.findFirst({
      where: {
        user_id: tempUser.id,
        type: 'email',
        otp: parseInt(emailOtp, 10),
      },
    });

    if (!emailOtpRecord) {
      return error(res, 'Invalid Email OTP', RESPONSE_CODES.FAILED, 400);
    }
    if (emailOtpRecord.is_verified) {
      return error(res, 'Email OTP already verified', RESPONSE_CODES.FAILED, 400);
    }
    if (emailOtpRecord.expires_at < now) {
      return error(res, 'Email OTP expired', RESPONSE_CODES.FAILED, 400);
    }

    const mobileOtpRecord = await prisma.otp_verifications.findFirst({
      where: {
        user_id: tempUser.id,
        type: 'mobile',
        otp: parseInt(mobileOtp, 10),
      },
    });

    if (!mobileOtpRecord) {
      return error(res, 'Invalid Mobile OTP', RESPONSE_CODES.FAILED, 400);
    }
    if (mobileOtpRecord.is_verified) {
      return error(res, 'Mobile OTP already verified', RESPONSE_CODES.FAILED, 400);
    }
    if (mobileOtpRecord.expires_at < now) {
      return error(res, 'Mobile OTP expired', RESPONSE_CODES.FAILED, 400);
    }

    await prisma.otp_verifications.updateMany({
      where: { id: { in: [emailOtpRecord.id, mobileOtpRecord.id] } },
      data: { is_verified: true },
    });

    await prisma.temp_users.update({
      where: { id: tempUser.id },
      data: { is_email_verified: true, is_mobile_verified: true, updated_at: now },
    });

    const existingUser = await prisma.users.findUnique({ where: { email: tempUser.email } });
    if (existingUser) {
      await prisma.temp_users.delete({ where: { id: tempUser.id } });
      return success(res, 'User already verified');
    }

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
        created_at: now,
        updated_at: now,
      },
    });

    await prisma.wallets.create({
      data: {
        user_id: newUser.id,
        balance: 0.0,
        lien_balance: 0.0,
        free_balance: 100.0,
        balance_expire_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        created_at: now,
        updated_at: now,
      },
    });

    await prisma.temp_users.delete({ where: { id: tempUser.id } });

    return success(
      res,
      `User verified and registered successfully using ${maskMobile(tempUser.mobile_no)} and ${maskEmail(tempUser.email)}`
    );
  } catch (err) {
    console.error('OTP verification error:', err);
    return error(res, 'Internal server error', RESPONSE_CODES.FAILED, 500);
  }
};