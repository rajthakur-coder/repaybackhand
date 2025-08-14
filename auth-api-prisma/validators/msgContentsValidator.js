// validations/msgContentsValidation.js
const { body, param } = require('express-validator');

// ===== Common Rules =====

// ID in URL param
const idParamRule = param('id')
  .isInt({ gt: 0 })
  .withMessage('Valid ID is required');

// ID in request body
const idBodyRule = body('id')
  .notEmpty().withMessage('ID is required')
  .isInt({ gt: 0 }).withMessage('ID must be a positive integer');

// Message type
const messageTypeRule = body('message_type')
  .notEmpty().withMessage('Message type is required')
  .isLength({ max: 100 }).withMessage('Message type must be at most 100 characters')
  .trim();

// Send flags (Yes / No)
const sendFlagRule = field => body(field)
  .optional()
  .isIn(['Yes', 'No']).withMessage(`${field} must be either Yes or No`)
  .trim();

// SMS template ID
const smsTemplateIdRule = body('sms_template_id')
  .optional()
  .isString().withMessage('SMS template ID must be a string')
  .isLength({ max: 50 }).withMessage('SMS template ID must be at most 50 characters')
  .trim();

// Generic text rule
const textRule = (field, max) => body(field)
  .optional()
  .isString().withMessage(`${field} must be a string`)
  .isLength({ max }).withMessage(`${field} must be at most ${max} characters`)
  .trim();

// Conditional content required if send flag is Yes
const conditionalContentRule = (contentField, sendFlagField) => body(contentField)
  .custom((value, { req }) => {
    if (req.body[sendFlagField] === 'Yes' && !value) {
      throw new Error(`${contentField} is required when ${sendFlagField} is Yes`);
    }
    return true;
  });

// ===== Validation Sets =====

// Add new message content
const addMsgContentValidation = [
  messageTypeRule,
  sendFlagRule('send_sms'),
  sendFlagRule('send_whatsapp'),
  sendFlagRule('send_email'),
  sendFlagRule('send_notification'),
  smsTemplateIdRule,
  textRule('sms_content', 500),
  textRule('whatsapp_content', 500),
  textRule('mail_subject', 255),
  textRule('mail_content', 2000),
  textRule('notification_title', 255),
  textRule('notification_content', 1000),
  textRule('keywords', 500),
  conditionalContentRule('sms_content', 'send_sms'),
  conditionalContentRule('whatsapp_content', 'send_whatsapp'),
  conditionalContentRule('mail_content', 'send_email'),
  conditionalContentRule('notification_content', 'send_notification')
];

// Update message content
const updateMsgContentValidation = [
  idBodyRule,
  ...addMsgContentValidation
];

// Get by ID
const getMsgContentByIdValidation = [
  idParamRule
];

// Delete message content
const deleteMsgContentValidation = [
  idParamRule
];

module.exports = {
  addMsgContentValidation,
  updateMsgContentValidation,
  getMsgContentByIdValidation,
  deleteMsgContentValidation
};
