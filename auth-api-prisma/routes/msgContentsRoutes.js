const express = require('express');
const router = express.Router();
const {
  addMsgContentValidation,
  updateMsgContentValidation,
  changeStatusValidation,
  deleteMsgContentValidation
} = require('../validators/msgContentsValidator');

const {
  addMsgContent,
  getMsgContentList,
  getMsgContentById,
  updateMsgContent,
  deleteMsgContent
} = require('../controllers/msgContentsController');

// ===== Routes =====

// Add new message content
router.post(
  '/add',
  addMsgContentValidation,
  addMsgContent
);

// List all with pagination/filter
router.post(
  '/list',
  getMsgContentList // no body validation needed here
);

// Get by ID
router.get(
  '/:id',
  deleteMsgContentValidation,
  getMsgContentById
);

// Update
router.put(
  '/updated',
  updateMsgContentValidation,
  updateMsgContent
);

// Delete
router.delete(
  '/delete/:id',
  deleteMsgContentValidation,
  deleteMsgContent
);

module.exports = router;
