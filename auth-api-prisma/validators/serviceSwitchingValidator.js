const { body, param } = require('express-validator');

// ID in URL params
const idParamRule = param('id')
  .isInt({ gt: 0 })
  .withMessage('Valid ID is required');

// ID in request body
const idBodyRule = body('id')
  .notEmpty().withMessage('ID is required')
  .isInt({ gt: 0 }).withMessage('Valid ID must be a positive integer');

// API ID
const apiIdRule = body('api_id')
  .notEmpty().withMessage('API ID is required')
  .isInt({ gt: 0 }).withMessage('API ID must be a positive integer');

// Product ID
const productIdRule = body('product_id')
  .notEmpty().withMessage('Product ID is required')
  .isInt({ gt: 0 }).withMessage('Product ID must be a positive integer');

// API Code
const apiCodeRule = body('api_code')
  .trim()
  .notEmpty().withMessage('API code is required')
  .isLength({ max: 50 }).withMessage('API code must be at most 50 characters');

// Rate
const rateRule = body('rate')
  .notEmpty().withMessage('Rate is required')
  .matches(/^\d+(\.\d+)?$/).withMessage('Rate must be a valid number');

// Commission/Surcharge
const commissionRule = body('commission_surcharge')
  .notEmpty().withMessage('Commission/Surcharge is required')
  .isLength({ max: 50 }).withMessage('Commission/Surcharge must be at most 50 characters');

// Flat/Percent
const flatPerRule = body('flat_per')
  .notEmpty().withMessage('Flat/Per is required')
  .isIn(['flat', 'percent']).withMessage('Flat/Per must be either flat or percent');

// GST
const gstRule = body('gst')
  .notEmpty().withMessage('GST is required')
  .isInt({ min: 0 }).withMessage('GST must be a non-negative integer');

// TDS
const tdsRule = body('tds')
  .notEmpty().withMessage('TDS is required')
  .isInt({ min: 0 }).withMessage('TDS must be a non-negative integer');

// Transaction Limit
const txnLimitRule = body('txn_limit')
  .notEmpty().withMessage('Transaction limit is required')
  .isInt({ gt: 0 }).withMessage('Transaction limit must be a positive integer');

// Status
const statusRule = body('status')
  .optional()
  .isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive');

// Add Service Switching
const addServiceSwitchingValidation = [
  apiIdRule,
  productIdRule,
  apiCodeRule,
  rateRule,
  commissionRule,
  flatPerRule,
  gstRule,
  tdsRule,
  txnLimitRule,
  statusRule
];

// Update Service Switching
const updateServiceSwitchingValidation = [
  idParamRule,
  apiIdRule,
  productIdRule,
  apiCodeRule,
  rateRule,
  commissionRule,
  flatPerRule,
  gstRule,
  tdsRule,
  txnLimitRule,
  statusRule
];

// Delete Service Switching
const deleteServiceSwitchingValidation = [
  idParamRule
];

module.exports = {
  addServiceSwitchingValidation,
  updateServiceSwitchingValidation,
  deleteServiceSwitchingValidation
};
