const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = {
  // randomUUID: () => Math.random().toString(36).substr(2, 9),
  randomUUID: () => Math.floor(100000 + Math.random() * 900000),

  maskMobile: (mobile) => `****${mobile.slice(-4)}`,

  maskEmail: (email) => {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}****@${domain}`;
  },

 sendOtpRegistration: async (receiver, type, user_id) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`OTP for ${receiver} [${type}] is: ${otp}`);
  

  await prisma.otp_verifications.create({
    
    data: {
      user_id: user_id,
      otp: parseInt(otp),
      type: type, // "email" or "mobile"
      expires_at: new Date(Date.now() + 5 * 60 * 1000),
      is_verified: false,
      created_at: new Date(),
      updated_at: new Date()
    }
  });

  return otp;
}

}


