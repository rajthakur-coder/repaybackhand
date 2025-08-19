const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { logAuditTrail } = require('../services/auditTrailService');
const {RESPONSE_CODES} = require('../utils/helper');
const { getNextSerial, reorderSerials } = require('../utils/serial');
const { success, error } = require('../utils/response');





dayjs.extend(utc);
dayjs.extend(timezone);


function formatISTDate(date) {
  return date ? dayjs(date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null;
}

function normalizeSendFlags(body) {
  return {
    send_sms: body.send_sms ?? 'Yes',
    send_whatsapp: body.send_whatsapp ?? 'Yes',
    send_email: body.send_email ?? 'Yes',
    send_notification: body.send_notification ?? 'No'
  };
}

// Add Message 
exports.addMsgContent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  try {
    const { message_type, sms_content, whatsapp_content, mail_content, notification_content } = req.body;

    const existing = await prisma.msg_contents.findFirst({
      where: {
        message_type,
        sms_content,
        whatsapp_content,
      }
    });

    if (existing) {
      return error(res, 'This Message Content already exists', RESPONSE_CODES.DUPLICATE, 409);
    }

    const dateObj = dayjs().tz('Asia/Kolkata').toDate();
    const sendFlags = normalizeSendFlags(req.body);

      // NEXT SERIAL_NO nikalna
const nextSerial = await getNextSerial(prisma, 'msg_contents');

    const newContent = await prisma.msg_contents.create({
      data: {
        serial_no: nextSerial,
        message_type,
        ...sendFlags,
        sms_template_id: req.body.sms_template_id,
        sms_content,
        whatsapp_content,
        mail_subject: req.body.mail_subject,
        mail_content,
        notification_title: req.body.notification_title,
        notification_content,
        keywords: req.body.keywords,
        created_at: dateObj,
        updated_at: dateObj
      }
    });

    try {
      await logAuditTrail({
        table_name: 'msg_contents',
        row_id: newContent.id,
        action: 'create',
        user_id: req.user?.id || null,
        ip_address: req.ip,
        remark: `Message content created for type ${message_type}`,
        status: 'Created'
      });
    } catch (auditErr) {
      console.error('Audit trail failed:', auditErr);
    }

     return success(res, 'Message Content Added Successfully');

  } catch (err) {
    console.error(err);
    return error(res, 'Failed to add Message Content', RESPONSE_CODES.FAILED, 500);
  }
};

// List Message 
exports.getMsgContentList = async (req, res) => {
  const offset = parseInt(req.body.offset) || 0;
  const limit = parseInt(req.body.limit) || 10;

  try {
    const total = await prisma.msg_contents.count();

    const data = await prisma.msg_contents.findMany({
      skip: offset * limit,
      take: limit,
      orderBy: { serial_no: 'asc' }  

    });

    const serializedData = data.map(item => ({
      ...item,
      id: Number(item.id),
      created_at: formatISTDate(item.created_at),
      updated_at: formatISTDate(item.updated_at)
    }));

    return success(res, 'Data fetched successfully', {
      recordsTotal: total,
      recordsFiltered: total,
      data: serializedData
    });
  } catch (err) {
    console.error(err);
    return error(res, 'Server error');
  }
};

// Get Message ID
exports.getMsgContentById = async (req, res) => {
  const id = parseInt(req.params.id);
 if (!id) {
    return error(res, 'Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  try {
    const content = await prisma.msg_contents.findUnique({ where: { id } });
    if (!content) {
      return error(res, 'Message Content Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    return success(res, 'Data fetched successfully', {
      ...content,
      id: Number(content.id),
      created_at: formatISTDate(content.created_at),
      updated_at: formatISTDate(content.updated_at)
    });
  } catch (err) {
    console.error(err);
    return error(res, 'Server error');
  }
};


// Update Message
exports.updateMsgContent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const id = Number(req.body.id);
  if (!id) {
    return error(res, 'Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  try {
    const content = await prisma.msg_contents.findUnique({ where: { id } });
    if (!content) {
      return error(res, 'Message Content Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }


    const sendFlags = normalizeSendFlags(req.body);

    const {
      message_type,
      sms_content,
      whatsapp_content,
      mail_content,
      notification_content
    } = req.body;

    const isSame =
      content.message_type === message_type &&
      content.sms_content === sms_content &&
      content.whatsapp_content === whatsapp_content &&
      content.mail_content === mail_content &&
      content.notification_content === notification_content &&
      content.sms_template_id === req.body.sms_template_id &&
      content.mail_subject === req.body.mail_subject &&
      content.notification_title === req.body.notification_title &&
      content.keywords === req.body.keywords &&
      content.send_sms === sendFlags.send_sms &&
      content.send_whatsapp === sendFlags.send_whatsapp &&
      content.send_email === sendFlags.send_email &&
      content.send_notification === sendFlags.send_notification;

    if (isSame) {
      return error(res, 'No changes detected, message content is already up-to-date', RESPONSE_CODES.DUPLICATE, 409);
    }

    const updatedAt = dayjs().tz('Asia/Kolkata').toDate();

    await prisma.msg_contents.update({
      where: { id },
      data: {
        message_type,
        ...sendFlags,
        sms_template_id: req.body.sms_template_id,
        sms_content,
        whatsapp_content,
        mail_subject: req.body.mail_subject,
        mail_content,
        notification_title: req.body.notification_title,
        notification_content,
        keywords: req.body.keywords,
        updated_at: updatedAt
      }
    });

    await logAuditTrail({
      table_name: 'msg_contents',
      row_id: id,
      action: 'update',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Message content updated for type ${message_type}`,
      status: 'Updated'
    });

       return success(res, 'Message Content updated successfully');


  } catch (err) {
    console.error(err);
      return error(res, 'Server error');

  }
};



// Delete Message
exports.deleteMsgContent = async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) {
    return error(res, 'Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  try {
    await prisma.msg_contents.delete({ where: { id } });

    await reorderSerials(prisma, 'msg_contents');

    try {
      await logAuditTrail({
        table_name: 'msg_contents',
        row_id: id,
        action: 'delete',
        user_id: req.user?.id || null,
        ip_address: req.ip,
        remark: 'Message content deleted',
        status: 'Deleted'
      });
    } catch (auditErr) {
      console.error('Audit trail failed:', auditErr);
    }

        return success(res, 'Message Content deleted successfully');

  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          return error(res, 'Message Content Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    }
    console.error(err);
    return error(res, 'Server error');    
    
  }
};
