const { body, param } = require('express-validator');

// =======================
// Product Category Validators
// =======================

// Common rules
const categoryNameRule = body('name')
  .trim()
  .notEmpty().withMessage('Category name is required')
  .isLength({ max: 100 }).withMessage('Category name must be at most 100 characters long');

const categoryStatusRule = body('status')
  .notEmpty().withMessage('Status is required')
  .isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive');

// Param ID rule
const categoryIdParamRule = param('id')
  .isInt({ gt: 0 }).withMessage('Valid Category ID is required');

// Validators
const addProductCategoryValidation = [categoryNameRule, categoryStatusRule];
const updateProductCategoryValidation = [categoryIdParamRule, categoryNameRule, categoryStatusRule];
const deleteCategoryValidation = [categoryIdParamRule];
const changeCategoryStatusValidation = [categoryIdParamRule, categoryStatusRule];

// =======================
// Product Validators
// =======================

// Common rules
const productIdParamRule = param('id')
  .isInt({ gt: 0 }).withMessage('Valid product ID is required');

const productCategoryIdRule = body('category_id')
  .notEmpty().withMessage('Category ID is required')
  .isInt({ gt: 0 }).withMessage('Valid category_id must be a positive integer');

const productNameRule = body('name')
  .trim()
  .notEmpty().withMessage('Product name is required')
  .isLength({ max: 150 }).withMessage('Product name must be at most 150 characters');

const productDescriptionRule = body('description')
  .optional({ nullable: true })
  .trim()
  .isLength({ max: 1000 }).withMessage('Description must be at most 1000 characters');

const productStatusRule = body('status')
  .notEmpty().withMessage('Status is required')
  .isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive');

// Validators
const addProductValidation = [
  productCategoryIdRule,
  productNameRule,
  productDescriptionRule,
  productStatusRule,
];

const updateProductValidation = [
  productIdParamRule,
  productCategoryIdRule,
  productNameRule,
  productDescriptionRule,
  productStatusRule,
];

const changeProductStatusValidation = [
  productIdParamRule,
  productStatusRule,
];

const deleteProductValidation = [
  productIdParamRule,
];

// =======================
// Product Price Validators
// =======================

const allowedCurrencies = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY'];

const priceProductIdRule = body('product_id')
  .notEmpty().withMessage('Product ID is required')
  .isInt({ gt: 0 }).withMessage('Product ID must be a positive integer');

const priceIdParamRule = param('id')
  .notEmpty().withMessage('Price ID is required')
  .isInt({ gt: 0 }).withMessage('Valid Price ID is required');

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

// Validators
const createProductPriceValidator = [
  priceProductIdRule,
  priceRule,
  currencyRule,
];

const updateProductPriceValidator = [
  priceIdParamRule,
  priceProductIdRule,
  priceRule,
  currencyRule,
];

const deleteProductPriceValidator = [
  priceIdParamRule,
];


// Export All Validators

module.exports = {
  // Product Category
  addProductCategoryValidation,
  updateProductCategoryValidation,
  deleteCategoryValidation,
  changeCategoryStatusValidation,

  // Product
  addProductValidation,
  updateProductValidation,
  changeProductStatusValidation,
  deleteProductValidation,

  // Product Price
  createProductPriceValidator,
  updateProductPriceValidator,
  deleteProductPriceValidator,
};
