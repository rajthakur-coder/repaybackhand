const jwtUtils = require('../utils/jwt');

function verifyTokenMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = jwtUtils.verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }

  req.user = decoded;
  next();
}

module.exports = verifyTokenMiddleware;





// const dayjs = require("dayjs");
// const prisma = require("../prismaClient");
// const { verifyToken } = require("../utils/jwt");

// async function verifyTokenMiddleware(req, res, next) {
//   try {
//     const authHeader = req.headers["authorization"];
//     if (!authHeader || !authHeader.startsWith("Bearer ")) {
//       return res.status(401).json({ message: "Unauthenticated" });
//     }

//     const token = authHeader.substring(7);

//     // 1️ JWT verify (basic signature check)
//     const decoded = verifyToken(token);
//     if (!decoded) {
//       return res.status(401).json({ message: "Invalid or Expired Token" });
//     }

//     // 2️ DB check
//     const accessToken = await prisma.userToken.findFirst({
//       where: { token },
//       include: { user: true },
//     });

//     if (!accessToken) {
//       return res.status(401).json({ message: "Invalid Bearer Token" });
//     }

//     // 3️ Expiry check
//     if (accessToken.expires_at) {
//       const now = dayjs();
//       const expires = dayjs(accessToken.expires_at);
//       if (now.isAfter(expires)) {
//         return res.status(401).json({ message: "Token expired" });
//       }
//     }

//     // 4️ Status check
//     if (accessToken.status === "inactive") {
//       return res.status(401).json({ message: "Unauthorized (Inactive Token)" });
//     }

//     // 5️ Role check
//     if (!["admin", "user", "manager"].includes(accessToken.user.role)) {
//       return res.status(403).json({ message: "Unauthorized Role" });
//     }

//     // 6️ Attach user details to request
//     req.user = {
//       id: accessToken.user_id,
//       role: accessToken.user.role,
//       token_type: accessToken.token_type,
//     };

//     return next();
//   } catch (err) {
//     console.error("Auth Middleware Error:", err);
//     return res.status(500).json({ message: "Internal Server Error" });
//   }
// }

// module.exports = verifyTokenMiddleware;
