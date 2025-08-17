const express = require('express');
const router = express.Router();
const verifyTokenMiddleware = require('../middleware/auth');

router.get('/protected', verifyTokenMiddleware, (req, res) => {
  res.json({ message: 'You are authorized', user: req.user });
});

module.exports = router;