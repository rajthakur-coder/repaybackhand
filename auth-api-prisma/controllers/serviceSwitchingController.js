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


const VALID_STATUS = ['Active', 'Inactive'];

function formatISTDate(date) {
  return date ? dayjs(date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null;
}

// Add Service Switching
exports.addServiceSwitching = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

  }

  const {
    api_id,
    product_id,
    api_code,
    rate,
    commission_surcharge,
    flat_per,
    gst,
    tds,
    txn_limit,
    status
  } = req.body;

  try {
    const apiExists = await prisma.msg_apis.findUnique({
      where: { id: BigInt(api_id) }
    });
    if (!apiExists) {
      return res.status(400).json({
        success: false,
        statusCode: RESPONSE_CODES.FAILED,
        message: 'API ID does not exist'
      });
    }

    const productExists = await prisma.products.findUnique({
      where: { id: BigInt(product_id) }
    });
    if (!productExists) {
      return res.status(400).json({
        success: false,
        statusCode: RESPONSE_CODES.FAILED,
        message: 'Product ID does not exist'
      });
    }

    const existing = await prisma.service_switchings.findFirst({
      where: { api_id: BigInt(api_id), product_id: BigInt(product_id) }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'Service Switching for this API and Product already exists'
      });
    }

    const dateObj = dayjs().tz('Asia/Kolkata').toDate();
 

const nextSerial = await getNextSerial(prisma, 'service_switchings');

    const newData = await prisma.service_switchings.create({
      data: {
        serial_no: nextSerial,
        api_id: BigInt(api_id),
        product_id: BigInt(product_id),
        api_code: String(api_code),
        rate: String(rate),
        commission_surcharge: String(commission_surcharge),
        flat_per: String(flat_per),
        gst: Number(gst),
        tds: Number(tds),
        txn_limit: Number(txn_limit),
        status: VALID_STATUS.includes(status?.toUpperCase()) ? status.toUpperCase() : 'ACTIVE',
        created_at: dateObj,
        updated_at: dateObj
      }
    });

    await logAuditTrail({
      table_name: 'service_switchings',
      row_id: newData.id,
      action: 'create',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Service Switching created for API Code ${api_code}`,
      status: 'Created'
    });

       return success(res, 'Message Content Added Successfully');

  } catch (err) {
    console.error('Add Service Switching Error:', err);
       return error(res, 'Failed to add Message Content');

  }
};


// List Service Switching
exports.getServiceSwitchingList = async (req, res) => {
  const offset = parseInt(req.body.offset) || 0;
  const limit = parseInt(req.body.limit) || 10;

  const product_id = req.body.product_id ? BigInt(req.body.product_id) : null;
  const apiId = req.body.apiId ? BigInt(req.body.apiId) : null;
  const statusFilter = VALID_STATUS.includes(req.body.status?.toUpperCase()) ? req.body.status.toUpperCase() : null;

  try {
    const where = {
      AND: [
        product_id ? { product_id } : null,
        apiId ? { api_id: apiId } : null,
        statusFilter ? { status: statusFilter } : null
      ].filter(Boolean)
    };

    const total = await prisma.service_switchings.count();
    const filteredCount = await prisma.service_switchings.count({ where });

    const data = await prisma.service_switchings.findMany({
      where,
      skip: offset * limit,
      take: limit,
      orderBy: { serial_no: 'asc' },
      include: { msg_apis: true, products: true }
    });

    const formattedData = data.map((item, index) => {
      let purchaseText = '';
      if (item.flat_per === 'flat') purchaseText = `Surcharge @ ${item.commission_surcharge} ₹/Txn`;
      if (item.flat_per === 'percent') purchaseText = `Commission @ ${item.commission_surcharge} %`;

      return {
        id: item.id.toString(),
        serial_no: item.serial_no,
        api_name: item.apis?.api_name || '',
        product: item.products?.name || '',
        apiServiceCode: item.api_code || '0',
        purchase: purchaseText,
        limit: item.txn_limit,
        status: item.status.toUpperCase()
      };
    });

    res.json({ recordsTotal: total, recordsFiltered: filteredCount, data: formattedData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Service Switching by ID
exports.getServiceSwitchingById = async (req, res) => {
  const id = BigInt(req.params.id);
  if (!id) {
      if (!id) return error(res, 'Id is required', RESPONSE_CODES.VALIDATION_ERROR);

  }

  try {
    const data = await prisma.service_switchings.findUnique({
      where: { id },
      include: { msg_apis: { select: { api_name: true } }, products: { select: { name: true } } }
    });

    if (!data) {
     return error(res, 'Service Switching not found', RESPONSE_CODES.NOT_FOUND);
    }

    const formattedData = {
      id: String(data.id),
      api_id: String(data.api_id),
      product_id: String(data.product_id),
      api_code: data.api_code,
      rate: data.rate,
      commission_surcharge: data.commission_surcharge,
      flat_per: data.flat_per,
      gst: data.gst,
      tds: data.tds,
      txn_limit: data.txn_limit,
      status: data.status,
      created_at: formatISTDate(data.created_at),
      updated_at: formatISTDate(data.updated_at),
      api_name: data.apis?.api_name || null,
      productsname: data.products?.name || null
    };

      return res.json({ success: true, statusCode: RESPONSE_CODES.SUCCESS, message: 'Data fetched successfully', data: formattedData });

  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED);
  }
};

// Update Service Switching
exports.updateServiceSwitching = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
   return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

  }

  const {
    id,
    api_id,
    product_id,
    api_code,
    rate,
    commission_surcharge,
    flat_per,
    gst,
    tds,
    txn_limit,
    status
  } = req.body;

  try {
    const existing = await prisma.service_switchings.findUnique({ where: { id: BigInt(id) } });
    if (!existing) {
            return error(res, 'Message Content Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    }

    const duplicate = await prisma.service_switchings.findFirst({
      where: {
        api_id: BigInt(api_id),
        product_id: BigInt(product_id),
        NOT: { id: BigInt(id) }
      }
    });
    if (duplicate) {
    return error(res, 'This Message Content already exists', RESPONSE_CODES.DUPLICATE, 409);

    }

    const updatedAt = dayjs().tz('Asia/Kolkata').toDate();

    await prisma.service_switchings.update({
      where: { id: BigInt(id) },
      data: {
        api_id: BigInt(api_id),
        product_id: BigInt(product_id),
        api_code: String(api_code),
        rate: String(rate),
        commission_surcharge: String(commission_surcharge),
        flat_per: String(flat_per),
        gst: Number(gst),
        tds: Number(tds),
        txn_limit: Number(txn_limit),
        status: VALID_STATUS.includes(status?.toUpperCase()) ? status.toUpperCase() : 'ACTIVE',
        updated_at: updatedAt
      }
    });

    await logAuditTrail({
      table_name: 'service_switchings',
      row_id: BigInt(id),
      action: 'update',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Service Switching updated for API Code ${api_code}`,
      status: 'Updated'
    });

   return success(res, 'Message Content Updated Successfully');

  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED);
  }
};

// Delete Service Switching
exports.deleteServiceSwitching = async (req, res) => {
  const id = BigInt(req.params.id);
  if (!id) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Id is required'
    });
  }

  try {
    await prisma.service_switchings.delete({ where: { id } });

    // 🔥 Reorder serial_no after delete
await reorderSerials(prisma, 'service_switchings');


    await logAuditTrail({
      table_name: 'service_switchings',
      row_id: id,
      action: 'delete',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Service Switching deleted`,
      status: 'Deleted'
    });

   return success(res, 'Message Content Added Successfully');

  } catch (err) {
    console.error(err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            return error(res, 'Message Content Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    }
    return error(res, 'Server error', RESPONSE_CODES.FAILED);
  }
};
