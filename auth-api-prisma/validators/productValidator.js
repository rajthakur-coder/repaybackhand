const { body, param } = require('express-validator');

// Reusable common rules
const idParamRule = param('id')
  .isInt({ gt: 0 })
  .withMessage('Valid product ID is required');

const idBodyRule = body('id')
  .notEmpty().withMessage('Product ID is required')
  .isInt({ gt: 0 }).withMessage('Valid product ID must be a positive integer');

const categoryIdRule = body('category_id')
  .notEmpty().withMessage('Category ID is required')
  .isInt({ gt: 0 }).withMessage('Valid category_id must be a positive integer');

const nameRule = body('name')
  .trim()
  .notEmpty().withMessage('Product name is required')
  .isLength({ max: 150 }).withMessage('Product name must be at most 150 characters');

const descriptionRule = body('description')
  .optional({ nullable: true })
  .trim()
  .isLength({ max: 1000 }).withMessage('Description must be at most 1000 characters');

const statusRule = body('status')
  .notEmpty().withMessage('Status is required')
  .isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive');

const addProductValidation = [
  categoryIdRule,
  nameRule,
  descriptionRule,
  statusRule,
];

const updateProductValidation = [
  idParamRule,
  categoryIdRule,
  nameRule,
  descriptionRule,
  statusRule,
];

const changeStatusValidation = [
  body('id')
    .notEmpty().withMessage('Product ID is required')
    .isInt({ gt: 0 }).withMessage('Valid product ID must be a positive integer'),
  statusRule,
];

const deleteProductValidation = [
  idParamRule,
];

module.exports = {
  addProductValidation,
  updateProductValidation,
  changeStatusValidation,
  deleteProductValidation,
};
