const { PrismaClient } = require('@prisma/client');
const useragent = require('useragent');
const prisma = new PrismaClient();

// OTP Generator
const randomUUID = () => Math.floor(100000 + Math.random() * 900000);

// Mobile Masking
const maskMobile = (mobile) => `****${mobile.slice(-4)}`;

//  Email Masking
const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}****@${domain}`;
};

// Send OTP and Save to DB
const sendOtpRegistration = async (receiver, type, user_id) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`OTP for ${receiver} [${type}] is: ${otp}`);

  await prisma.otp_verifications.create({
    data: {
      user_id: user_id,
      otp: parseInt(otp),
      type: type, 
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
      is_verified: false,
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  return otp;
};

//  Get Client IP Address
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    null
  );
};

module.exports = {
  randomUUID,
  maskMobile,
  maskEmail,
  sendOtpRegistration,
  getClientIp,
  useragent
};

