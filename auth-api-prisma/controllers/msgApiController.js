const { PrismaClient } = require('@prisma/client');
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


//Add New API 
exports.addMsgApi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const { api_name, api_type, base_url, params, method, status } = req.body;

  try {
    const existingApi = await prisma.msg_apis.findFirst({
      where: { api_name: { equals: api_name, mode: 'insensitive' } }
    });

    if (existingApi) {
      return error(res, 'API with the same name already exists', RESPONSE_CODES.DUPLICATE, 409);
    }

    const dateObj = dayjs().tz('Asia/Kolkata').toDate();

    const newApi = await prisma.$transaction(async (tx) => {
      const nextSerial = await getNextSerial(prisma, 'msg_apis');


      const api = await tx.msg_apis.create({
        data: { 
          api_name, api_type, base_url, params, method, status,
          created_at: dateObj, updated_at: dateObj,
          serial_no: nextSerial 
        }
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

return success(res, 'Message Content Added Successfully');
  } catch (err) {
    console.error(err);
    return error(res, 'Failed to add Message Content', RESPONSE_CODES.FAILED, 500);
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
      orderBy: { serial_no: 'asc' }   // 👈 yaha se proper numbering dikhegi

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
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

//Get API by ID
exports.getMsgApiById = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return error(res, 'Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
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
      return error(res, 'Message Content Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    return success(res, 'Data fetched successfully', {
      ...api,
      id: Number(api.id),
      created_at: formatISTDate(api.created_at),
      updated_at: formatISTDate(api.updated_at)
    });
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

//Update API
exports.updateMsgApi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
       return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

  }

  const { id, api_name, api_type, base_url, params, method, status } = req.body;

  if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
    return error(res, 'Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
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

    return success(res, 'Message API  updated successfully');
  } catch (err) {
    console.error(err);
    if (err.message === 'API_NOT_FOUND') {
      return error(res, 'Messaging API not found', RESPONSE_CODES.NOT_FOUND, 404);
    }
    if (err.message === 'DUPLICATE_NAME') {
      return error(res, 'Another API with same name exists', RESPONSE_CODES.DUPLICATE, 409);
    }
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

//Delete API
exports.deleteMsgApi = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
       return error(res, 'Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

  }

  try {
    const api = await prisma.msg_apis.findUnique({ where: { id } });
    if (!api) {
          return error(res, 'Message Content Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    }

    await prisma.msg_apis.delete({ where: { id } });

    // 🔥 Reorder serial numbers after delete
   await reorderSerials(prisma, 'msg_apis');

    await logAuditTrail({
      table_name: 'msg_apis',
      row_id: id,
      action: 'delete',
      user_id: req.user?.id,
      ip_address: req.ip,
      remark: `Messaging API deleted`,
      status: 'Deleted'
    });

    return success(res, 'Message API deleted successfully');
  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};
