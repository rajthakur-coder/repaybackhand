const { body, param } = require('express-validator');

// Common ID param rule
const idParamRule = param('id')
  .isInt({ gt: 0 })
  .withMessage('Valid signature ID is required');

// Common ID in body
const idBodyRule = body('id')
  .notEmpty().withMessage('Signature ID is required')
  .isInt({ gt: 0 }).withMessage('Valid signature ID must be a positive integer');

// Signature type rule
const signatureTypeRule = body('signature_type')
  .notEmpty().withMessage('Signature type is required')
  .isIn(['SMS', 'Whatsapp']).withMessage('Signature type must be either SMS or Whatsapp');

// Signature text rule
const signatureRule = body('signature')
  .trim()
  .notEmpty().withMessage('Signature text is required')
  .isLength({ max: 255 }).withMessage('Signature text must be at most 255 characters');

// Status rule
const statusRule = body('status')
  .notEmpty().withMessage('Status is required')
  .isIn(['active', 'inactive']).withMessage('Status must be active or inactive');

// ===== Validation sets =====

// Add new signature
const addSignatureValidation = [
  signatureTypeRule,
  signatureRule,
  statusRule
];

// Update signature
const updateSignatureValidation = [
  idBodyRule,
  signatureTypeRule,
  signatureRule,
  statusRule
];

// Change status only
const changeStatusValidation = [
  idBodyRule,
  statusRule
];

// Delete signature
const deleteSignatureValidation = [
  idParamRule
];

module.exports = {
  addSignatureValidation,
  updateSignatureValidation,
  changeStatusValidation,
  deleteSignatureValidation
};
