const { body, param } = require('express-validator');

const getAuditTrailListValidation = [
  body('table_name').optional().isString().withMessage('table_name must be a string'),
  body('action').optional().isIn(['create', 'update', 'delete', 'approve', 'reject', 'password_change']),
  body('created_by').optional().isInt({ gt: 0 }),
  body('status').optional().isString(),
  body('offset').optional().isInt({ min: 0 }).toInt(),
  body('limit').optional().isInt({ min: 1 }).toInt(),
];

const getAuditTrailByIdValidation = [
  param('id').isInt({ gt: 0 }).withMessage('Valid audit trail ID is required'),
];

module.exports = {
  getAuditTrailListValidation,
  getAuditTrailByIdValidation,
};
