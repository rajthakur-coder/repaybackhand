const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { logAuditTrail } = require('../services/auditTrailService');
const { RESPONSE_CODES } = require('../utils/helper');
const { getNextSerial, reorderSerials } = require('../utils/serial');
const { success, error } = require('../utils/response');
const { safeParseInt, convertBigIntToString } = require('../utils/parser');

dayjs.extend(utc);
dayjs.extend(timezone);

function formatISTDate(date) {
  return date ? dayjs(date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null;
}


exports.addMsgApi = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(
      res,
      errors.array()[0].msg,
      RESPONSE_CODES.VALIDATION_ERROR,
      422
    );
  }

  const { api_name, api_type, base_url, params, method, status } = req.body;

  // Additional status check
  const validStatuses = ['active', 'inactive'];
  if (!validStatuses.includes(status?.toLowerCase())) {
    return error(
      res,
      'Status must be active or inactive',
      RESPONSE_CODES.VALIDATION_ERROR,
      422
    );
  }

  const dateObj = dayjs().tz('Asia/Kolkata').toDate();

  try {
    // 3️Transaction-safe creation
    const newApi = await prisma.$transaction(async (tx) => {
      // Duplicate check inside transaction
      const existingApi = await tx.msg_apis.findFirst({
        where: { api_name: { equals: api_name, mode: 'insensitive' } }
      });

      if (existingApi) {
        throw new Error('DUPLICATE_API');
      }

      // Get next serial number atomically
      const nextSerial = await getNextSerial(tx, 'msg_apis');

      // Create API record
      const api = await tx.msg_apis.create({
        data: {
          api_name,
          api_type,
          base_url,
          params,
          method,
          status,
          created_at: dateObj,
          updated_at: dateObj,
          serial_no: nextSerial
        }
      });

      // Audit log awaited
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

      const safeApi = {
      ...newApi,
      id: newApi.id.toString(),
      serial_no: newApi.serial_no.toString()
    };

    // 4️⃣ Success response
    return success(res, 'Message API Added Successfully');

  } catch (err) {
    // 5️⃣ Duplicate error handling
    if (err.message === 'DUPLICATE_API') {
      return error(
        res,
        'API with the same name already exists',
        RESPONSE_CODES.DUPLICATE,
        409
      );
    }

    console.error('Failed to add API:', err);
    return error(res, 'Failed to add Message API', RESPONSE_CODES.FAILED, 500);
  }
};

// List APIs
exports.getMsgApiList = async (req, res) => {
  const offset = safeParseInt(req.body.offset, 0);
  const limit = safeParseInt(req.body.limit, 10);

  if (offset < 0 || limit <= 0) {
    return error(
      res,
      'Offset must be >= 0 and limit must be > 0',
      RESPONSE_CODES.VALIDATION_ERROR,
      422
    );
  }

  const searchValue = req.body.searchValue || '';
  const apiType = req.body.api_type;
  const statusFilter = req.body.status;

  try {
    // 2 Build where filter
    const where = {
      AND: [
        searchValue ? { api_name: { contains: searchValue, mode: 'insensitive' } } : null,
        apiType && apiType !== 'All' ? { api_type: apiType } : null,
        statusFilter && statusFilter !== 'All' ? { status: statusFilter } : null
      ].filter(Boolean)
    };

    const [total, filteredCount, data] = await Promise.all([
      prisma.msg_apis.count(),
      prisma.msg_apis.count({ where }),
      prisma.msg_apis.findMany({
        where,
        skip: offset * limit,     
        take: limit,
        orderBy: { serial_no: 'asc' }
      })
    ]);

    const serializedData = data.map(item => ({
      ...item,
      id: item.id.toString(),
      serial_no: item.serial_no.toString(),
      created_at: formatISTDate(item.created_at),
      updated_at: formatISTDate(item.updated_at)
    }));

    //  Send response
    return res.status(200).json({
      success: true,
      statusCode: 1,
      message: 'Data fetched successfully',
      recordsTotal: total,
      recordsFiltered: filteredCount,
      data: serializedData
    });

  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// Get API by ID
exports.getMsgApiById = async (req, res) => {
  const id = safeParseInt(req.params.id);
  if (!id || id <= 0) {
    return error(res, 'Message API Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
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
      return error(res, 'Message API Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    const safeApi = convertBigIntToString(api);

    return success(res, 'Data fetched successfully', {
      ...safeApi,
      created_at: formatISTDate(api.created_at),
      updated_at: formatISTDate(api.updated_at)
    });

  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// Update API
exports.updateMsgApi = async (req, res) => {
  // 1️⃣ Validation
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const id = safeParseInt(req.params.id);
  if (!id || id <= 0) {
    return error(res, 'Invalid or missing ID', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const { api_name, api_type, base_url, params, method, status } = req.body;

  try {
    const updatedAt = dayjs().tz('Asia/Kolkata').toDate();

    await prisma.$transaction(async (tx) => {
      // 2️⃣ Fetch current API
      const api = await tx.msg_apis.findUnique({ where: { id } });
      if (!api) throw new Error('API_NOT_FOUND');

      // 3️⃣ Check for duplicates (other records with same name)
      const duplicate = await tx.msg_apis.findFirst({
        where: { 
          api_name: { equals: api_name, mode: 'insensitive' },
          id: { not: id } 
        }
      });
      if (duplicate) throw new Error('DUPLICATE_NAME');

      // 4️⃣ Check if data is actually changed
      const isSame =
        api.api_name === api_name &&
        api.api_type === api_type &&
        api.base_url === base_url &&
        api.params === params &&
        api.method === method &&
        api.status === status;

      if (isSame) {
        // Already up-to-date → no update needed
        return error(res, 'No changes detected. API already up-to-date', RESPONSE_CODES.FAILED, 200);
      }

      // 5️⃣ Update record
      await tx.msg_apis.update({
        where: { id },
        data: { api_name, api_type, base_url, params, method, status, updated_at: updatedAt }
      });

      // 6️⃣ Audit log
      await logAuditTrail({
        table_name: 'msg_apis',
        row_id: id,
        action: 'update',
        user_id: req.user?.id || null,
        ip_address: req.ip,
        remark: `Messaging API "${api_name}" updated`,
        status
      });
    });

    // 7️⃣ Success response
    return success(res, 'Message API updated successfully');

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

// Delete API
exports.deleteMsgApi = async (req, res) => {
  const id = safeParseInt(req.params.id);
  if (!id || id <= 0) {
    return error(res, 'Message Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  try {
    const api = await prisma.msg_apis.findUnique({ where: { id } });
    if (!api) {
      return error(res, 'Message API Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.msg_apis.delete({ where: { id } });
      await reorderSerials(tx, 'msg_apis');

      logAuditTrail({
        table_name: 'msg_apis',
        row_id: id,
        action: 'delete',
        user_id: req.user?.id,
        ip_address: req.ip,
        remark: `Messaging API deleted`,
        status: 'Deleted'
      }).catch(err => console.error('Audit log failed:', err));
    });

    return success(res, 'Message API deleted successfully');

  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};
