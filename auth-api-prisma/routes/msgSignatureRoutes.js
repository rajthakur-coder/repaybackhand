const express = require('express');
const router = express.Router();
const signatureController = require('../controllers/msgSignatureController');
const {
  addSignatureValidation,
  updateSignatureValidation,
  changeStatusValidation,
  deleteSignatureValidation
} = require('../validators/msgSignatureValidator');

// Add new signature
router.post(
  '/add',
  addSignatureValidation,
  signatureController.addSignature
);

// Get list of signatures
router.post(
  '/list',
  signatureController.getSignatureList
);

// Get single signature by ID
router.get(
  '/byid/:id',
  signatureController.getSignatureById
);

// Update signature
router.put(
  '/updated',
  updateSignatureValidation,
  signatureController.updateSignature
);

// Delete signature
router.delete(
  '/delete/:id',
  deleteSignatureValidation,
  signatureController.deleteSignature
);

module.exports = router;
