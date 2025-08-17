const { body, param } = require('express-validator');

// Product Category Validators

// Common rules
const categoryNameRule = body('name')
  .trim()
  .notEmpty().withMessage('Category name is required')
  .isLength({ max: 100 }).withMessage('Category name must be at most 100 characters long');

const categoryStatusRule = body('status')
  .notEmpty().withMessage('Status is required')
  .isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive');

const categoryIdRule = body('id')
  .notEmpty().withMessage('Category ID is required')
  .isInt({ gt: 0 }).withMessage('Valid category ID is required');

// Validators
const productCategoryValidation = [categoryNameRule, categoryStatusRule];
const updateProductCategoryValidation = [categoryIdRule, categoryNameRule, categoryStatusRule];
const deleteCategoryValidation = [categoryIdRule];
const changeCategoryStatusValidation = [categoryIdRule, categoryStatusRule];

// Product Validators

// Common rules
const productIdParamRule = param('id')
  .isInt({ gt: 0 }).withMessage('Valid product ID is required');

const productIdBodyRule = body('id')
  .notEmpty().withMessage('Product ID is required')
  .isInt({ gt: 0 }).withMessage('Valid product ID must be a positive integer');

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
  productIdBodyRule,
  productCategoryIdRule,
  productNameRule,
  productDescriptionRule,
  productStatusRule,
];

const changeProductStatusValidation = [
  productIdBodyRule,
  productStatusRule,
];

const deleteProductValidation = [
  productIdParamRule,
];

//Product Price Validators 

const allowedCurrencies = ['USD', 'INR', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY'];

const priceProductIdRule = body('product_id')
  .notEmpty().withMessage('Product ID is required')
  .isInt({ gt: 0 }).withMessage('Product ID must be a positive integer');

  const priceIdBodyRule = body('id')
  .notEmpty().withMessage('Price ID is required')
  .isInt({ gt: 0 }).withMessage('Valid Price ID must be a positive integer');

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

const priceIdParamRule = param('id')
  .notEmpty().withMessage('Price ID is required')
  .isInt({ gt: 0 }).withMessage('Valid Price ID is required');

const createProductPriceValidator = [
  priceProductIdRule,
  priceRule,
  currencyRule,
];

const updateProductPriceValidator = [
  priceIdBodyRule,
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
  productCategoryValidation,
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
