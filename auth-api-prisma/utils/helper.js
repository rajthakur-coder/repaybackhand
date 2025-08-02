module.exports = {
  randomUUID: () => Math.random().toString(36).substr(2, 9),

  maskMobile: (mobile) => `****${mobile.slice(-4)}`,

  maskEmail: (email) => {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}****@${domain}`;
  },

  sendOtpRegistration: async (email, type) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`OTP for ${email} [${type}] is: ${otp}`); 
    return otp; 
  }
};
