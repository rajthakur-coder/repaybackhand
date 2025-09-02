const { body, param } = require('express-validator');

// Common Validators 

// ID in URL param
const idParamRule = param('id')
  .isInt({ gt: 0 }).withMessage('Valid API ID is required');

// ID in body
const idBodyRule = body('id')
  .isInt({ gt: 0 }).withMessage('Valid API ID is required');

// API Type
const apiTypeRule = body('api_type')
  .isIn(['SMS', 'Whatsapp']).withMessage('API type must be SMS or Whatsapp');

// HTTP Method
const methodRule = body('method')
  .isIn(['GET', 'POST']).withMessage('Method must be GET or POST');

// Status
const statusRule = body('status')
  .isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive');

// API Name
const apiNameRule = body('api_name')
  .trim()
  .notEmpty().withMessage('API name is required')
  .isLength({ max: 255 }).withMessage('API name must be at most 255 characters');

// Base URL
const baseUrlRule = body('base_url')
  .trim()
  .notEmpty().withMessage('Base URL is required')
  .isURL().withMessage('Base URL must be a valid URL');


const paramsRule = body('params')
  // .optional()
  .isString().withMessage('Params must be a valid string')
  .notEmpty().withMessage('Params cannot be empty')
  .isLength({ max: 1000 }).withMessage('Params too long');


// Add new API
const addApiValidation = [
  apiNameRule,
  apiTypeRule,
  baseUrlRule,
  paramsRule,
  methodRule,
  statusRule
];

// Update API
const updateApiValidation = [
  idParamRule,
  apiNameRule,
  apiTypeRule,
  baseUrlRule,
  methodRule,
  statusRule,
  paramsRule
];

// Delete API
const deleteApiValidation = [idParamRule];

// Get API by ID
const getApiByIdValidation = [idParamRule];

module.exports = {
  addApiValidation,
  updateApiValidation,
  deleteApiValidation,
  getApiByIdValidation
};

