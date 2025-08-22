const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { logAuditTrail } = require('../services/auditTrailService');
const { RESPONSE_CODES } = require('../utils/helper');
const { success, error } = require('../utils/response');

dayjs.extend(utc);
dayjs.extend(timezone);

function getISTDate() {
  return dayjs().tz('Asia/Kolkata').toDate();
}

async function logSignatureAudit({ id, action, user_id, ip_address, signature_type, status }) {
  await logAuditTrail({
    table_name: 'msg_signature',
    row_id: id,
    action,
    user_id,
    ip_address,
    remark: `Signature ${action}d for ${signature_type}`,
    status
  });
}

exports.addOrUpdateSignature = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const { signature, signature_type, status } = req.body;
  const user_id = req.user?.id || null;
  const ip_address = req.ip;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.msg_signature.findFirst({ where: { signature_type } });
      const now = getISTDate();

      if (existing) {
        if (existing.signature === signature && existing.status.toLowerCase() === status) {
          return { message: 'Already up-to-date', alreadyUpdated: true };
        }

        // Update
        await tx.msg_signature.update({
          where: { id: existing.id },
          data: { signature, status, updated_at: now }
        });

        await logSignatureAudit({
          id: existing.id,
          action: 'update',
          user_id,
          ip_address,
          signature_type,
          updated_by: req.user?.id || null,
          status
        });

        return { message: 'Signature updated successfully', alreadyUpdated: false };
      } else {
        // Create
        const newSig = await tx.msg_signature.create({
          data: { signature, signature_type, status, created_at: now, updated_at: now }
        });

        await logSignatureAudit({
          id: newSig.id,
          action: 'create',
          user_id,
          ip_address,
          signature_type,
          created_by: req.user?.id || null,
          status
        });

        return { message: 'Signature added successfully', alreadyUpdated: false };
      }
    });

    return res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: result.message
    });
  } catch (err) {
    console.error(err);
    return error(res, 'Server error');

  }
};
