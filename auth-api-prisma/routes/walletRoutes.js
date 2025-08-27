const express = require('express');
const router = express.Router();
const walletController = require('../controllers/WalletController');
const authMiddleware  = require('../middleware/auth');

router.get('/wallet', authMiddleware, walletController.getWalletByUserId);  // Get wallet details
 // Move money to lien

module.exports = router;
