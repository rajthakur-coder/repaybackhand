const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const { logAuditTrail } = require('../services/auditTrailService');
const { RESPONSE_CODES } = require('../utils/helper');
const { success, error } = require('../utils/response');


function safeParseInt(value, fallback = null) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function convertBigIntToString(obj) {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

//ADD product
module.exports = {
  async addProductPrice(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

    }

    const product_id = safeParseInt(req.body.product_id);
    const price = parseFloat(req.body.price);
    const currency = (req.body.currency || '').trim();

    if (!product_id || !price || !currency) {
      return error(res, 'Product ID, price, and currency are required and must be valid', RESPONSE_CODES.VALIDATION_ERROR, 422);
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

      const Product_price = await prisma.product_pricing.create({
        data: {
          product_id,
          price,
          currency,
          created_at: new Date(),
        }
      });

      await logAuditTrail({
        table_name: 'product_pricing',
        row_id: Product_price.id,
        action: 'create',
        user_id: req.user?.id,
        ip_address: req.ip,
        remark: `Price ${price} ${currency} added for product ID ${product_id}`,
        status: "Active"
      });

      return success(res, 'Product price added successfully');

    } catch (error) {
      console.error('addProductPrice error:', error);
      return error(res, 'Server error');

    }
  },

  // get product
  async getProductPricingList(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

    }

    const offset = parseInt(req.body.offset) || 0;
    const limit = parseInt(req.body.limit) || 10;
    const searchValue = (req.body.searchValue || '').trim();

    try {
      const where = searchValue
        ? {
          products: {
            name: { contains: searchValue, mode: 'insensitive' },
          },
        }
        : {};

      const total = await prisma.product_pricing.count();
      const filteredCount = await prisma.product_pricing.count({ where });

      const skip = offset * limit;

      const data = await prisma.product_pricing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'asc' },
        include: {
          products: {
            select: { name: true },
          },
        },
      });

      const formattedData = data.map(item => ({
        ...item,
        id: item.id.toString(),
        product_id: item.product_id.toString(),
        products: item.products?.name || null,
        price: item.price.toString(),
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      // return success(res, 'Data fetched successfully', {
      //   recordsTotal: total,
      //   recordsFiltered: filteredCount,
      //   data: formattedData.length > 0 ? formattedData[0] : null,
      // });

      
      return res.status(200).json({
    success: true,
    statusCode: 1,
    message: 'Data fetched successfully',
    recordsTotal: total,
    recordsFiltered: filteredCount,
    data: formattedData.length > 0 ? formattedData[0] : null,
});

    } catch (error) {
      console.error('getProductPricingList error:', error);
      return error(res, 'Server error');

    }
  },


  //get product ID
  async getProductPriceById(req, res) {
    const id = safeParseInt(req.params.id);

    if (!id) {
      return error(res, 'Price ID is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

    }

    try {
      const price = await prisma.product_pricing.findUnique({
        where: { id },
        include: {
          products: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!price) {
        return error(res, 'Product pricing not found', RESPONSE_CODES.NOT_FOUND, 404);

      }

      const formattedPrice = JSON.parse(
        JSON.stringify(price, (_, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      );

      if (formattedPrice.products && formattedPrice.products.name) {
        formattedPrice.products = formattedPrice.products.name;
      } else {
        formattedPrice.products = null;
      }
      return success(res, 'Data fetched successfully', {

        data: formattedPrice,
      });
    } catch (error) {
      console.error('getProductPriceById error:', error);
      return error(res, 'Server error');

    }
  },


  //updated product
  async updateProductPrice(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

    }

    const id = safeParseInt(req.params.id);
    if (!id) {
      return error(res, 'Price ID is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    const product_id = safeParseInt(req.body.product_id);
    const price = parseFloat(req.body.price);
    const currency = (req.body.currency || '').trim();

    if (!product_id || !price || !currency) {
      return error(res, 'Product ID, price, and currency are required and must be valid', RESPONSE_CODES.VALIDATION_ERROR, 422);

    }

    try {
      const existing = await prisma.product_pricing.findUnique({ where: { id } });
      if (!existing) {
        return error(res, 'Product price Not Found', RESPONSE_CODES.NOT_FOUND, 404);

      }

      const productExists = await prisma.products.findUnique({ where: { id: product_id } });
      if (!productExists) {
        return error(res, 'Product not found', RESPONSE_CODES.NOT_FOUND, 404);
      }

      const duplicate = await prisma.product_pricing.findFirst({
        where: {
          id: { not: id },
          product_id: product_id,
        }
      });

      if (duplicate) {
        return error(res, 'No changes detected, Product price is already up-to-date', RESPONSE_CODES.DUPLICATE, 409);

      }

      const isSame =
        Number(existing.product_id) === Number(product_id) &&
        Number(existing.price) === Number(price) &&
        (existing.currency || '').toLowerCase() === currency.toLowerCase();


      if (isSame) {
        return error(res, 'No changes detected, Product price is already up-to-date', RESPONSE_CODES.DUPLICATE, 409);

      }

      await prisma.product_pricing.update({
        where: { id },
        data: {
          product_id,
          price,
          currency,
          updated_at: new Date()
        }
      });


      await logAuditTrail({
        table_name: 'product_pricing',
        row_id: id,
        action: 'update',
        user_id: req.user?.id,
        ip_address: req.ip,
        remark: `Price updated to ${price} ${currency} for product ID ${product_id}`,
        status: 'Active'
      });

      return success(res, 'Product price updated successfully');

    } catch (error) {
      console.error('updateProductPrice error:', error);
      return error(res, 'Server error');

    }
  },

  //deleted product
  async deleteProductPrice(req, res) {
    const id = safeParseInt(req.params.id);

    if (!id) {
      return error(res, 'product Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

    }

    try {
      const existing = await prisma.product_pricing.findUnique({ where: { id } });
      if (!existing) {
        return error(res, 'Product price Not Found', RESPONSE_CODES.NOT_FOUND, 404);

      }

      await prisma.product_pricing.delete({ where: { id } });

      await logAuditTrail({
        table_name: 'product_pricing',
        row_id: id,
        action: 'delete',
        user_id: req.user?.id,
        ip_address: req.ip,
        remark: `Product pricing deleted`,
        status: 'Deleted'
      });

      return success(res, 'Product price deleted successfully');

    } catch (error) {
      console.error('deleteProductPrice error:', error);
      return error(res, 'Server error');

    }
  }
};

