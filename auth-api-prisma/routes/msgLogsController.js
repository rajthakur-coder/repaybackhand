const express = require('express');
const router = express.Router();
const { getMessageLogs } = require('../controllers/msgLogsController');

// POST: Get Message Logs
router.post('/list', getMessageLogs);

module.exports = router;
