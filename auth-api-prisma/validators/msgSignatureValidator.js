const { body, param } = require('express-validator');

// ===== Common rules =====

// ID in URL param
const idParamRule = param('id')
  .isInt({ gt: 0 }).withMessage('Valid signature ID is required');

// ID in request body
const idBodyRule = body('id')
  .notEmpty().withMessage('Signature ID is required')
  .isInt({ gt: 0 }).withMessage('Valid signature ID must be a positive integer');

// Signature type rule
const signatureTypeRule = body('signature_type')
  .trim()
  .notEmpty().withMessage('Signature type is required')
  .custom(value => {
    const allowed = ['sms', 'whatsapp'];
    if (!allowed.includes(value.toLowerCase())) {
      throw new Error('Signature type must be either SMS or Whatsapp');
    }
    return true;
  });

// Signature text rule
const signatureRule = body('signature')
  .trim()
  .escape() // sanitize input to prevent XSS
  .notEmpty().withMessage('Signature text is required')
  .isLength({ max: 255 }).withMessage('Signature text must be at most 255 characters');

// Status rule
const statusRule = body('status')
  .trim()
  .notEmpty().withMessage('Status is required')
  .custom(value => {
    const allowed = ['active', 'inactive'];
    if (!allowed.includes(value.toLowerCase())) {
      throw new Error('Status must be active or inactive');
    }
    return true;
  });

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
