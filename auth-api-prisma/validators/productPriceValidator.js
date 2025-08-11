const { body, param } = require('express-validator');
const allowedCurrencies = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY']; // Apni required currency codes yahan add karein

// Common validation rules
const productIdRule = body('product_id')
  .notEmpty().withMessage('Product ID is required')
  .isInt({ gt: 0 }).withMessage('Product ID must be a positive integer');

const priceRule = body('price')
  .notEmpty().withMessage('Price is required')
  .isFloat({ gt: 0 }).withMessage('Price must be a positive number');

const currencyRule = body('currency')
  .notEmpty().withMessage('Currency is required')
  .isString().withMessage('Currency must be a string')
  .isLength({ max: 10 }).withMessage('Currency must be at most 10 characters long')
  .custom(value => {
    if (!allowedCurrencies.includes(value.toUpperCase())) {
      throw new Error(`Currency must be one of: ${allowedCurrencies.join(', ')}`);
    }
    return true;
  });

const idParamRule = param('id')
  .notEmpty().withMessage('Price ID is required')
  .isInt({ gt: 0 }).withMessage('Valid Price ID is required');

const createProductPriceValidator = [
  productIdRule,
  priceRule,
  currencyRule,
];

const updateProductPriceValidator = [
  idParamRule,
  productIdRule,
  priceRule,
  currencyRule,
];

const deleteProductPriceValidator = [
  idParamRule,
];

module.exports = {
  createProductPriceValidator,
  updateProductPriceValidator,
  deleteProductPriceValidator,
};
