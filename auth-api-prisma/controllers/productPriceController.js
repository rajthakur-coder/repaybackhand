const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const { logAuditTrail } = require('../services/auditTrailService');


const RESPONSE_CODES = {
  SUCCESS: 1,
  VALIDATION_ERROR: 2,
  FAILED: 0,
  DUPLICATE: 3,
  NOT_FOUND: 4
};

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
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: errors.array()[0].msg
      });
    }

    const product_id = safeParseInt(req.body.product_id);
    const price = parseFloat(req.body.price);
    const currency = (req.body.currency || '').trim();

    if (!product_id || !price || !currency) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: 'Product ID, price, and currency are required and must be valid'
      });
    }

    try {
      const productExists = await prisma.products.findUnique({ where: { id: product_id } });
      if (!productExists) {
        return res.status(404).json({
          success: false,
          statusCode: RESPONSE_CODES.NOT_FOUND,
          message: 'Product not found'
        });
      }

      const exists = await prisma.product_pricing.findFirst({ where: { product_id } });
      if (exists) {
        return res.status(409).json({
          success: false,
          statusCode: RESPONSE_CODES.DUPLICATE,
          message: 'This product already has a price entry.'
        });
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


      return res.status(201).json({
        success: true,
        statusCode: RESPONSE_CODES.SUCCESS,
        message: 'Product price added successfully'
      });
    } catch (error) {
      console.error('addProductPrice error:', error);
      return res.status(500).json({
        success: false,
        statusCode: RESPONSE_CODES.FAILED,
        message: 'Server error'
      });
    }
  },

  // get product
  async getProductPricingList(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: errors.array()[0].msg,
      });
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
        orderBy: { id: 'desc' },
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

      return res.json({
        recordsTotal: total,
        recordsFiltered: filteredCount,
        data: formattedData.length > 0 ? formattedData[0] : null,
      });
    } catch (error) {
      console.error('getProductPricingList error:', error);
      return res.status(500).json({
        success: false,
        statusCode: RESPONSE_CODES.FAILED,
        message: 'Server error',
      });
    }
  },


  //get product ID
  async getProductPriceById(req, res) {
    const id = safeParseInt(req.params.id);

    if (!id) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: 'Valid price ID is required',
      });
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
        return res.status(404).json({
          success: false,
          statusCode: RESPONSE_CODES.NOT_FOUND,
          message: 'Product pricing not found',
        });
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

      return res.json({
        success: true,
        statusCode: RESPONSE_CODES.SUCCESS,
        data: formattedPrice,
      });
    } catch (error) {
      console.error('getProductPriceById error:', error);
      return res.status(500).json({
        success: false,
        statusCode: RESPONSE_CODES.FAILED,
        message: 'Server error',
      });
    }
  },


  //updated product
  async updateProductPrice(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: errors.array()[0].msg,
      });
    }

    const id = safeParseInt(req.body.id);
    if (!id) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: 'Price ID is required',
      });
    }

    const product_id = safeParseInt(req.body.product_id);
    const price = parseFloat(req.body.price);
    const currency = (req.body.currency || '').trim();

    if (!product_id || !price || !currency) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: 'Product ID, price, and currency are required and must be valid',
      });
    }

    try {
      const existing = await prisma.product_pricing.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          statusCode: RESPONSE_CODES.NOT_FOUND,
          message: 'Product price not found',
        });
      }

      const productExists = await prisma.products.findUnique({ where: { id: product_id } });
      if (!productExists) {
        return res.status(404).json({
          success: false,
          statusCode: RESPONSE_CODES.NOT_FOUND,
          message: 'Product not found',
        });
      }

      const duplicate = await prisma.product_pricing.findFirst({
        where: {
          id: { not: id },
          product_id: product_id,
        }
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          statusCode: RESPONSE_CODES.DUPLICATE,
          message: 'Another price entry for this product already exists',
        });
      }

      const isSame =
        Number(existing.product_id) === Number(product_id) &&
        Number(existing.price) === Number(price) &&
        (existing.currency || '').toLowerCase() === currency.toLowerCase();


      if (isSame) {
        return res.status(200).json({
          success: true,
          statusCode: RESPONSE_CODES.DUPLICATE,
          message: 'Price is already updated with the same data',
        });
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

      return res.json({
        success: true,
        statusCode: RESPONSE_CODES.SUCCESS,
        message: 'Product price updated successfully',
      });
    } catch (error) {
      console.error('updateProductPrice error:', error);
      return res.status(500).json({
        success: false,
        statusCode: RESPONSE_CODES.FAILED,
        message: 'Failed to update product price',
      });
    }
  },

  //deleted product
  async deleteProductPrice(req, res) {
    const id = safeParseInt(req.params.id);

    if (!id) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: 'Valid price ID is required'
      });
    }

    try {
      const existing = await prisma.product_pricing.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          statusCode: RESPONSE_CODES.NOT_FOUND,
          message: 'Product price not found'
        });
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

      return res.json({
        success: true,
        statusCode: RESPONSE_CODES.SUCCESS,
        message: 'Product price deleted successfully'
      });
    } catch (error) {
      console.error('deleteProductPrice error:', error);
      return res.status(500).json({
        success: false,
        statusCode: RESPONSE_CODES.FAILED,
        message: 'Server error'
      });
    }
  }
};

