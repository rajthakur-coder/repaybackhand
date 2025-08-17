const { PrismaClient } = require('@prisma/client');
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

// Add Signature
exports.addSignature = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg
    });
  }

  const { signature, signature_type, status } = req.body;

  try {
    const existing = await prisma.msg_signature.findFirst({
      where: {
        signature: { equals: signature, mode: 'insensitive' },
        signature_type
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'Signature already exists for this type'
      });
    }

    const dateObj = dayjs().tz('Asia/Kolkata').toDate();

    const newSig = await prisma.msg_signature.create({
      data: { signature, signature_type, status, created_at: dateObj, updated_at: dateObj }
    });

    await logAuditTrail({
      table_name: 'msg_signature',
      row_id: newSig.id,
      action: 'create',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Signature created for ${signature_type}`,
      status
    });

    res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Signature Added Successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Failed to add Signature'
    });
  }
};

// List Signatures
exports.getSignatureList = async (req, res) => {
  const offset = parseInt(req.body.offset) || 0;
  const limit = parseInt(req.body.limit) || 10;
  const searchValue = req.body.searchValue || '';
  const sigType = req.body.signature_type;
  const statusFilter = req.body.status;

  try {
    const where = {
      AND: [
        searchValue
          ? { signature: { contains: searchValue, mode: 'insensitive' } }
          : null,
        sigType && sigType !== 'All'
          ? { signature_type: sigType }
          : null,
        statusFilter && statusFilter !== 'All'
          ? { status: statusFilter }
          : null
      ].filter(Boolean)
    };

    const total = await prisma.msg_signature.count();
    const filteredCount = await prisma.msg_signature.count({ where });

    const data = await prisma.msg_signature.findMany({
      where,
      skip: offset * limit,
      take: limit,
      orderBy: { id: 'desc' }
    });

    const serializedData = data.map(item => ({
      ...item,
      id: Number(item.id),
      created_at: item.created_at ? item.created_at.toISOString() : null,
      updated_at: item.updated_at ? item.updated_at.toISOString() : null
    }));

    res.json({
      recordsTotal: total,
      recordsFiltered: filteredCount,
      data: serializedData
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Signature by ID
exports.getSignatureById = async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) {
    return res.status(400).json({
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Id is required'
    });
  }

  try {
    const sig = await prisma.msg_signature.findUnique({
      where: { id },
      select: {
        id: true, signature: true, signature_type: true, status: true, created_at: true, updated_at: true
      }
    });

    if (!sig) {
      return res.status(404).json({
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Invalid id found'
      });
    }

    res.json({
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Data fetched successfully',
      data: {
        ...sig,
        id: Number(sig.id),
        created_at: formatISTDate(sig.created_at),
        updated_at: formatISTDate(sig.updated_at)
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

// Update Signature
exports.updateSignature = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg
    });
  }

  const { id, signature, signature_type, status } = req.body;

  try {
    const sig = await prisma.msg_signature.findUnique({ where: { id: Number(id) } });
    if (!sig) {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Signature Not Found'
      });
    }

    const duplicate = await prisma.msg_signature.findFirst({
      where: {
        signature: { equals: signature, mode: 'insensitive' },
        signature_type,
        id: { not: Number(id) }
      }
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'Another Signature with the same text exists for this type'
      });
    }

    const updatedAt = dayjs().tz('Asia/Kolkata').toDate();

    await prisma.msg_signature.update({
      where: { id: Number(id) },
      data: { signature, signature_type, status, updated_at: updatedAt }
    });

    await logAuditTrail({
      table_name: 'msg_signature',
      row_id: Number(id),
      action: 'update',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Signature updated for ${signature_type}`,
      status
    });

    res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Signature updated successfully'
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

// Delete Signature
exports.deleteSignature = async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Id is required'
    });
  }

  try {
    await prisma.msg_signature.delete({ where: { id } });

    await logAuditTrail({
      table_name: 'msg_signature',
      row_id: id,
      action: 'delete',
      user_id: req.user?.id,
      ip_address: req.ip,
      remark: `Signature deleted`,
      status: 'Deleted'
    });

    res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Signature deleted successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(404).json({
      success: false,
      statusCode: RESPONSE_CODES.NOT_FOUND,
      message: 'Signature Not found'
    });
  }
};
