const { body, param } = require('express-validator');

// Reusable common rules
const nameRule = body('name')
  .trim()
  .notEmpty().withMessage('Category name is required')
  .isLength({ max: 100 }).withMessage('Category name must be at most 100 characters long');

const statusRule = body('status')
  .notEmpty().withMessage('Status is required')
  .isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive');

const idRule = body('id')
  .notEmpty().withMessage('Category ID is required')
  .isInt({ gt: 0 }).withMessage('Valid category ID is required');

// Validators
const productCategoryValidation = [nameRule, statusRule];

const updateProductCategoryValidation = [idRule, nameRule, statusRule];

const deleteCategoryValidation = [idRule];

const changeStatusValidation = [idRule, statusRule];

const deleteProductValidation = [
  param('id')
    .isInt({ gt: 0 }).withMessage('Valid product ID is required'),
];

module.exports = {
  productCategoryValidation,
  updateProductCategoryValidation,
  deleteCategoryValidation,
  changeStatusValidation,
  deleteProductValidation
};
