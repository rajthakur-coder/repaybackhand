const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { logAuditTrail } = require('../services/auditTrailService');

dayjs.extend(utc);
dayjs.extend(timezone);

const RESPONSE_CODES = {
  SUCCESS: 1,
  VALIDATION_ERROR: 2,
  FAILED: 0,
  DUPLICATE: 3,
  NOT_FOUND: 4
};

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
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg
    });
  }

  try {
    const { message_type, sms_content, whatsapp_content, mail_content, notification_content } = req.body;

    const existing = await prisma.msg_contents.findFirst({
      where: {
        message_type,
        sms_content,
        whatsapp_content,
        mail_content,
        notification_content
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'This Message Content already exists'
      });
    }

    const dateObj = dayjs().tz('Asia/Kolkata').toDate();
    const sendFlags = normalizeSendFlags(req.body);

    const newContent = await prisma.msg_contents.create({
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

    res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Message Content Added Successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Failed to add Message Content'
    });
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
      orderBy: { id: 'asc' }
    });

    const serializedData = data.map(item => ({
      ...item,
      id: Number(item.id),
      created_at: formatISTDate(item.created_at),
      updated_at: formatISTDate(item.updated_at)
    }));

    res.json({
      recordsTotal: total,
      recordsFiltered: total,
      data: serializedData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Message ID
exports.getMsgContentById = async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Id is required'
    });
  }

  try {
    const content = await prisma.msg_contents.findUnique({ where: { id } });
    if (!content) {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Message Content Not Found'
      });
    }

    res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Data fetched successfully',
      data: {
        ...content,
        id: Number(content.id),
        created_at: formatISTDate(content.created_at),
        updated_at: formatISTDate(content.updated_at)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Server error'
    });
  }
};

// Update Message
exports.updateMsgContent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg
    });
  }

  const id = Number(req.body.id);
  if (!id) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Id is required'
    });
  }

  try {
    const content = await prisma.msg_contents.findUnique({ where: { id } });
    if (!content) {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Message Content Not Found'
      });
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
      return res.status(409).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'No changes detected, message content is already up-to-date'
      });
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

    res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Message Content updated successfully'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Server error'
    });
  }
};



// Delete Message
exports.deleteMsgContent = async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Id is required'
    });
  }

  try {
    await prisma.msg_contents.delete({ where: { id } });

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

    res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Message Content deleted successfully'
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Message Content Not Found'
      });
    }
    console.error(err);
    res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Server error'
    });
  }
};
