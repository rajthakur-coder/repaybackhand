const { body } = require('express-validator');

const allowedSignatureTypes = ['sms', 'whatsapp']; // compare lowercase
const allowedStatuses = ['active', 'inactive'];

const addOrUpdateSignatureValidator = [
  body('signature')
    .notEmpty().withMessage('Signature is required')
    .isString().withMessage('Signature must be a string'),

  body('signature_type')
    .notEmpty().withMessage('Signature type is required')
    .isString().withMessage('Signature type must be a string')
    .custom(value => {
      if (!allowedSignatureTypes.includes(value.toLowerCase())) {
        throw new Error(`Invalid signature_type. Allowed types: SMS, Whatsapp`);
      }
      return true;
    })
    .customSanitizer(value => {
      const lower = value.toLowerCase();
      if (lower === 'sms') return 'SMS';
      if (lower === 'whatsapp') return 'Whatsapp';
      return value;
    }),

  body('status')
    .notEmpty().withMessage('Status is required')
    .custom(value => {
      if (!allowedStatuses.includes(value.toLowerCase())) {
        throw new Error(`Invalid status. Allowed: ${allowedStatuses.join(', ')}`);
      }
      return true;
    })
    .customSanitizer(value => value.toLowerCase())
];

module.exports = { addOrUpdateSignatureValidator };
