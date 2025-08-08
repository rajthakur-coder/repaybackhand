const express = require('express');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { generateToken, verifyToken } = require('../utils/jwt');
const router = express.Router();
const prisma = new PrismaClient();
const Helper = require('../utils/helper');

const {
    randomUUID,
    maskEmail,
    maskMobile,
    sendOtpRegistration,
    getClientIp,
    useragent
} = require('../utils/helper');




// Register
exports.register = async (req, res) => {
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

        const tempUserToken = generateToken({ id: tempUser.id, email: tempUser.email });

        return res.status(200).json({
            success: true,
            statusCode: 1,
            message: 'OTP sent for email and mobile verification',
            tempUserId: tempUserToken,
            Email: maskEmail(tempUser.email),
            Mobile: maskMobile(tempUser.mobile_no),
        });

    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({
            success: false,
            statusCode: 0,
            message: 'Internal server error'
        });
    }
  
};



//loginUser
exports.loginUser = async (req, res) => {
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
                    statusCode: 5,
                    verify: 'mobile',
                    message: 'Mobile verification pending',
                    info: Helper.maskMobile(tempUser.mobile_no),
                });
            }

            if (tempUser.is_email_verified !== 1) {
                await Helper.sendOtpRegistration(tempUser.email, 'email', tempUser.id);
                return res.status(200).json({
                    success: false,
                    statusCode: 5,
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
                    role: 'user',  // role 'user' by default on creation
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
            return res.status(401).json({
                success: false,
                statusCode: 0,
                message: 'Invalid email address',
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
                message: 'Incorrect password',
            });
        }

        // Role check: sirf user aur admin allowed hain
        const allowedRoles = ['user', 'admin'];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({
                success: false,
                statusCode: 0,
                message: 'Unauthorized role',
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                statusCode: 0,
                message: 'Account not active',
            });
        }

        const token = generateToken({
            id: user.id,
            uuid: user.uuid,
            email: user.email,
            role: user.role,
        });



// Verify OTP
exports.verifyOtp = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            statusCode: 2,
            message: errors.array()[0].msg
        });
    }

    const { tempUserId, emailOtp, mobileOtp } = req.body;
    const now = new Date();
    let tempUser;

    try {
        const decoded = verifyToken(tempUserId);
        if (!decoded || !decoded.email) {
            return res.status(400).json({
                success: false,
                statusCode: 0,
                message: 'Invalid or expired temp user token'
            });
        }

        const id = decoded.id;
        tempUser = await prisma.temp_users.findUnique({ where: { id } });

        if (!tempUser) {
            const alreadyRegistered = await prisma.users.findUnique({ where: { email: decoded.email } });
            if (alreadyRegistered) {
                return res.status(200).json({
                    success: true,
                    statusCode: 1,
                    message: 'User already verified'
                });
            }

            return res.status(404).json({
                success: false,
                statusCode: 0,
                message: 'Temporary user not found'
            });
        }

        const emailOtpRecord = await prisma.otp_verifications.findFirst({
            where: {
                user_id: tempUser.id,
                type: 'email',
                otp: parseInt(emailOtp)
            }
        });

        if (!emailOtpRecord || emailOtpRecord.expires_at < now || emailOtpRecord.is_verified) {
            return res.status(400).json({
                success: false,
                statusCode: 0,
                message: !emailOtpRecord
                    ? 'Invalid Email OTP'
                    : emailOtpRecord.expires_at < now
                        ? 'Email OTP expired'
                        : 'Email OTP already verified'
            });
        }

        const mobileOtpRecord = await prisma.otp_verifications.findFirst({
            where: {
                user_id: tempUser.id,
                type: 'mobile',
                otp: parseInt(mobileOtp)
            }
        });

        if (!mobileOtpRecord || mobileOtpRecord.expires_at < now || mobileOtpRecord.is_verified) {
            return res.status(400).json({
                success: false,
                statusCode: 0,
                message: !mobileOtpRecord
                    ? 'Invalid Mobile OTP'
                    : mobileOtpRecord.expires_at < now
                        ? 'Mobile OTP expired'
                        : 'Mobile OTP already verified'
            });
        }

        await prisma.otp_verifications.updateMany({
            where: { id: { in: [emailOtpRecord.id, mobileOtpRecord.id] } },
            data: { is_verified: true }
        });

        const existingUser = await prisma.users.findUnique({ where: { email: tempUser.email } });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                statusCode: 0,
                message: 'User already verified'
            });
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
                updated_at: now
            }
        });

        await prisma.wallets.create({
            data: {
                user_id: newUser.id,
                balance: 0.0,
                lien_balance: 0.0,
                free_balance: 100.0,
                balance_expire_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                created_at: now,
                updated_at: now
            }
        });

        await prisma.temp_users.delete({ where: { id: tempUser.id } });

        return res.status(200).json({
            success: true,
            statusCode: 1,
            message: `User verified and registered successfully using ${maskMobile(tempUser.mobile_no)} and ${maskEmail(tempUser.email)}`
        });

    } catch (err) {
        console.error('OTP verification error:', err);
        return res.status(500).json({
            success: false,
            statusCode: 0,
            message: 'Internal server error'
        });
    }
  
};

