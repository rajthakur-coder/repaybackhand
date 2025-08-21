const jwt = require('jsonwebtoken');

const generateToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || '1h') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

// const verifyToken = (token) => {
//   if (!process.env.JWT_SECRET) {
//     console.error('JWT_SECRET is not defined in environment variables');
//     return null;
//   }

//   try {
//     return jwt.verify(token, process.env.JWT_SECRET);
//   } catch (err) {
//     console.error('JWT verification failed:', err.message);
//     return null;
//   }
// };

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not defined in environment variables");
    return null;
  }

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
