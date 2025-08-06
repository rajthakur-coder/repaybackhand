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
