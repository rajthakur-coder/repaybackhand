// const express = require('express');
// const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
// const cors = require('cors');

// dotenv.config();

// const app = express();
// app.use(express.json());
// app.use(cors());

// app.use('/api/v1', authRoutes);


// app.get('/protected', verifyTokenMiddleware, (req, res) => {
//   res.json({ message: 'You are authorized', user: req.user });
// });
// const jwt = require('jsonwebtoken');
// function verifyTokenMiddleware(req, res, next) {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];

//   if (!token) return res.status(401).json({ error: 'No token provided' });

//   jwt.verify(token, 'secret_key', (err, user) => {
//     if (err) return res.status(401).json({ error: 'Token expired or invalid' });

//     req.user = user;
//     next();
//   });
// }

// // STEP 3: Protected Route
// app.get('/protected', verifyTokenMiddleware, (req, res) => {
//   res.json({ message: 'You are authorized', user: req.user });
// });

// // Start server
// app.listen(5000, () => {
//   console.log('Server running on port 5000');
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });



const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const jwtUtils = require('./utils/jwt'); 

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use('/api/v1', authRoutes);

// ✅ Middleware using your utils
function verifyTokenMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token provided' });

  const decoded = jwtUtils.verifyToken(token);

  if (!decoded) return res.status(401).json({ error: 'Token expired or invalid' });

  req.user = decoded;
  next();
}

// ✅ Protected route
app.get('/protected', verifyTokenMiddleware, (req, res) => {
  res.json({ message: 'You are authorized', user: req.user });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
