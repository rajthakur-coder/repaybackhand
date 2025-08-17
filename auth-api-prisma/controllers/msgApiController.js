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

function apiResponse({ success = true, statusCode = RESPONSE_CODES.SUCCESS, message = '', data = null }) {
  const response = { success, statusCode, message };
  if (data !== undefined && data !== null) {
    response.data = data; // only include 'data' if it's not null or undefined
  }
  return response;
}

//Add New API 
exports.addMsgApi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(apiResponse({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg
    }));
  }

  const { api_name, api_type, base_url, params, method, status } = req.body;

  try {
    const existingApi = await prisma.msg_apis.findFirst({
      where: { api_name: { equals: api_name, mode: 'insensitive' } }
    });

    if (existingApi) {
      return res.status(409).json(apiResponse({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'API with the same name already exists'
      }));
    }

    const dateObj = dayjs().tz('Asia/Kolkata').toDate();

    const newApi = await prisma.$transaction(async (tx) => {
      const api = await tx.msg_apis.create({
        data: { api_name, api_type, base_url, params, method, status, created_at: dateObj, updated_at: dateObj }
      });

      await logAuditTrail({
        table_name: 'msg_apis',
        row_id: api.id,
        action: 'create',
        user_id: req.user?.id || null,
        ip_address: req.ip,
        remark: `Messaging API "${api_name}" created`,
        status
      });

      return api;
    });

    res.json(apiResponse({ message: 'Messaging API added successfully' }));
  } catch (err) {
    console.error(err);
    res.status(500).json(apiResponse({ success: false, statusCode: RESPONSE_CODES.FAILED, message: 'Failed to add Messaging API' }));
  }
};

//List APIs 
exports.getMsgApiList = async (req, res) => {
  const offset = Math.max(0, parseInt(req.body.offset) || 0);
  const limit = Math.max(1, parseInt(req.body.limit) || 10);
  const searchValue = req.body.searchValue || '';
  const apiType = req.body.api_type;
  const statusFilter = req.body.status;

  try {
    const where = {
      AND: [
        searchValue ? { api_name: { contains: searchValue, mode: 'insensitive' } } : null,
        apiType && apiType !== 'All' ? { api_type: apiType } : null,
        statusFilter && statusFilter !== 'All' ? { status: statusFilter } : null
      ].filter(Boolean)
    };

    const total = await prisma.msg_apis.count();
    const filteredCount = await prisma.msg_apis.count({ where });

    const data = await prisma.msg_apis.findMany({
      where,
      skip: offset * limit,
      take: limit,
      orderBy: { id: 'desc' }
    });

    const serializedData = data.map(item => ({
      ...item,
      id: Number(item.id),
      created_at: formatISTDate(item.created_at),
      updated_at: formatISTDate(item.updated_at)
    }));

    res.json(apiResponse({
      message: 'APIs fetched successfully',
      data: {
        recordsTotal: total,
        recordsFiltered: filteredCount,
        data: serializedData
      }
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(apiResponse({ success: false, statusCode: RESPONSE_CODES.FAILED, message: 'Server error' }));
  }
};

//Get API by ID
exports.getMsgApiById = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json(apiResponse({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Valid ID is required'
    }));
  }

  try {
    const api = await prisma.msg_apis.findUnique({
      where: { id },
      select: {
        id: true, api_name: true, api_type: true, base_url: true, params: true,
        method: true, status: true, created_at: true, updated_at: true
      }
    });

    if (!api) {
      return res.status(404).json(apiResponse({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Messaging API not found'
      }));
    }

    res.json(apiResponse({
      message: 'API fetched successfully',
      data: {
        ...api,
        id: Number(api.id),
        created_at: formatISTDate(api.created_at),
        updated_at: formatISTDate(api.updated_at)
      }
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(apiResponse({ success: false, statusCode: RESPONSE_CODES.FAILED, message: 'Server error' }));
  }
};

//Update API
exports.updateMsgApi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(apiResponse({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg
    }));
  }

  const { id, api_name, api_type, base_url, params, method, status } = req.body;

  if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
    return res.status(400).json(apiResponse({ success: false, statusCode: RESPONSE_CODES.VALIDATION_ERROR, message: 'Valid ID required' }));
  }

  try {
    const updatedAt = dayjs().tz('Asia/Kolkata').toDate();

    await prisma.$transaction(async (tx) => {
      const api = await tx.msg_apis.findUnique({ where: { id: Number(id) } });
      if (!api) throw new Error('API_NOT_FOUND');

      const duplicate = await tx.msg_apis.findFirst({
        where: { api_name: { equals: api_name, mode: 'insensitive' }, id: { not: Number(id) } }
      });
      if (duplicate) throw new Error('DUPLICATE_NAME');

      await tx.msg_apis.update({
        where: { id: Number(id) },
        data: { api_name, api_type, base_url, params, method, status, updated_at: updatedAt }
      });

      await logAuditTrail({
        table_name: 'msg_apis',
        row_id: Number(id),
        action: 'update',
        user_id: req.user?.id || null,
        ip_address: req.ip,
        remark: `Messaging API "${api_name}" updated`,
        status
      });
    });

    res.json(apiResponse({ message: 'Messaging API updated successfully' }));
  } catch (err) {
    console.error(err);
    if (err.message === 'API_NOT_FOUND') {
      return res.status(404).json(apiResponse({ success: false, statusCode: RESPONSE_CODES.NOT_FOUND, message: 'Messaging API not found' }));
    }
    if (err.message === 'DUPLICATE_NAME') {
      return res.status(409).json(apiResponse({ success: false, statusCode: RESPONSE_CODES.DUPLICATE, message: 'Another API with same name exists' }));
    }
    res.status(500).json(apiResponse({ success: false, statusCode: RESPONSE_CODES.FAILED, message: 'Server error' }));
  }
};

//Delete API
exports.deleteMsgApi = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(422).json(apiResponse({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Valid ID is required'
    }));
  }

  try {
    const api = await prisma.msg_apis.findUnique({ where: { id } });
    if (!api) {
      return res.status(404).json(apiResponse({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Messaging API not found'
      }));
    }

    await prisma.msg_apis.delete({ where: { id } });

    await logAuditTrail({
      table_name: 'msg_apis',
      row_id: id,
      action: 'delete',
      user_id: req.user?.id,
      ip_address: req.ip,
      remark: `Messaging API deleted`,
      status: 'Deleted'
    });

    res.json(apiResponse({ message: 'Messaging API deleted successfully' }));
  } catch (err) {
    console.error(err);
    res.status(500).json(apiResponse({ success: false, statusCode: RESPONSE_CODES.FAILED, message: 'Server error' }));
  }
};
