const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const { logAuditTrail } = require('../services/auditTrailService');
const { RESPONSE_CODES } = require('../utils/helper');
const { success, error } = require('../utils/response');
const { safeParseInt, convertBigIntToString } = require('../utils/parser');
const { getNextSerial, reorderSerials } = require('../utils/serial');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');


dayjs.extend(utc);
dayjs.extend(timezone);
const ISTFormat = (d) => (d ? dayjs(d).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null);



module.exports = {
  // ADD product price
  async addProductPrice(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    const product_id = safeParseInt(req.body.product_id);
    const price = parseFloat(req.body.price);
    const currency = (req.body.currency || '').trim();

    if (!product_id || !price || !currency) {
      return error(
        res,
        'Product ID, price, and currency are required and must be valid',
        RESPONSE_CODES.VALIDATION_ERROR,
        422
      );
    }

    try {
      const productExists = await prisma.products.findUnique({ where: { id: product_id } });
      if (!productExists) {
        return error(res, 'Product not found', RESPONSE_CODES.NOT_FOUND, 404);
      }

      const exists = await prisma.product_pricing.findFirst({ where: { product_id } });
      if (exists) {
        return error(res, 'This product already has a price entry.', RESPONSE_CODES.DUPLICATE, 409);
      }

      const nextSerial = await getNextSerial(prisma, 'product_pricing');

      const Product_price = await prisma.product_pricing.create({
        data: {
          product_id,
          price,
          currency,
          created_at: new Date(),
          serial_no: nextSerial
        },
      });

      logAuditTrail({
        table_name: 'product_pricing',
        row_id: Product_price.id,
        action: 'create',
        user_id: req.user?.id,
        ip_address: req.ip,
        remark: `Price ${price} ${currency} added for product ID ${product_id}`,
        status: 'Active',
        created_by: req.user?.id || null
      }).catch((err) => console.error('Audit log failed:', err));

      return res.status(200).json({
        success: true,
        statusCode: 1,
        message: 'Product price added successfully',
      });
    } catch (err) {
      console.error('addProductPrice error:', err);
      return error(res, 'Server error');
    }
  },

  // GET product pricing list
  async getProductPricingList(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    const offset = safeParseInt(req.body.offset, 0);
    const limit = safeParseInt(req.body.limit, 10);
    const searchValue = (req.body.searchValue || '').trim();

    try {
      const where = searchValue
        ? {
          products: {
            name: { contains: searchValue, mode: 'insensitive' },
          },
        }
        : {};

      const [total, filteredCount, data] = await Promise.all([
        prisma.product_pricing.count(),
        prisma.product_pricing.count({ where }),
        prisma.product_pricing.findMany({
          where,
          skip: offset * limit,
          take: limit,
          orderBy: { serial_no: 'asc' },
          include: {
            products: {
              select: { name: true },
            },
          },
        }),
      ]);

      const formattedData = data.map((item) => ({
        ...item,
        id: item.id.toString(),
        product_id: item.product_id.toString(),
        products: item.products?.name || null,
        price: item.price.toString(),
        created_at: ISTFormat(item.created_at),
        updated_at: ISTFormat(item.updated_at),
      }));

      return res.status(200).json({
        success: true,
        statusCode: 1,
        message: 'Data fetched successfully',
        recordsTotal: total,
        recordsFiltered: filteredCount,
        data: formattedData, // Always array
      });
    } catch (err) {
      console.error('getProductPricingList error:', err);
      return error(res, 'Server error');
    }
  },

  // GET product price by ID
  async getProductPriceById(req, res) {
    const id = safeParseInt(req.params.id);

    if (!id) {
      return error(res, 'Price ID is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    try {
      const price = await prisma.product_pricing.findUnique({
        where: { id },
        include: {
          products: { select: { name: true } },
        },
      });

      if (!price) {
        return error(res, 'Product pricing not found', RESPONSE_CODES.NOT_FOUND, 404);
      }

      const formattedPrice = convertBigIntToString(price);
      formattedPrice.products = formattedPrice.products?.name || null;

      return res.status(200).json({
        success: true,
        statusCode: 1,
        message: 'Data fetched successfully',
        data: formattedPrice,
      });
    } catch (err) {
      console.error('getProductPriceById error:', err);
      return error(res, 'Server error');
    }
  },

  // UPDATE product price
  async updateProductPrice(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    const id = safeParseInt(req.params.id);
    if (!id) {
      return error(res, 'Price ID is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    const price = parseFloat(req.body.price);
    const currency = (req.body.currency || '').trim();

    if (!price || !currency) {
      return error(
        res,
        'Price and currency are required and must be valid',
        RESPONSE_CODES.VALIDATION_ERROR,
        422
      );
    }

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.product_pricing.findUnique({ where: { id } });
        if (!existing) {
          throw { msg: 'Product price Not Found', code: RESPONSE_CODES.NOT_FOUND, status: 404 };
        }

        const isSame =
          Number(existing.price) === Number(price) &&
          (existing.currency || '').toLowerCase() === currency.toLowerCase();

        if (isSame) {
          throw {
            msg: 'No changes detected, Product price is already up-to-date',
            code: RESPONSE_CODES.DUPLICATE,
            status: 409,
          };
        }

        await tx.product_pricing.update({
          where: { id },
          data: {
            price,
            currency,
            updated_at: new Date(),
          },
        });
      });

      logAuditTrail({
        table_name: 'product_pricing',
        row_id: id,
        action: 'update',
        user_id: req.user?.id,
        ip_address: req.ip,
        remark: `Price updated to ${price} ${currency} for product price ID ${id}`,
        status: 'Active',
        updated_by: req.user?.id || null
      }).catch((err) => console.error('Audit log failed:', err));

      return success(res, 'Product price updated successfully');
    } catch (err) {
      if (err?.msg) {
        return error(res, err.msg, err.code, err.status);
      }
      console.error('updateProductPrice error:', err);
      return error(res, 'Server error');
    }
  },

  // DELETE product price
  async deleteProductPrice(req, res) {
    const id = safeParseInt(req.params.id);

    if (!id) {
      return error(res, 'Product Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.product_pricing.findUnique({ where: { id } });
        if (!existing) {
          throw { msg: 'Product price Not Found', code: RESPONSE_CODES.NOT_FOUND, status: 404 };
        }

        await tx.product_pricing.delete({ where: { id } });
        await reorderSerials(tx, 'product_pricing');

      });



      logAuditTrail({
        table_name: 'product_pricing',
        row_id: id,
        action: 'delete',
        user_id: req.user?.id,
        ip_address: req.ip,
        remark: `Product pricing deleted`,
        status: 'Deleted',
        deleted_by: req.user?.id || null,
      }).catch((err) => console.error('Audit log failed:', err));

      return success(res, 'Product price deleted successfully');
    } catch (err) {
      if (err?.msg) {
        return error(res, err.msg, err.code, err.status);
      }
      console.error('deleteProductPrice error:', err);
      return error(res, 'Server error');
    }
  },
};
