const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const slugify = require('slugify');
const path = require('path');
const fs = require('fs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { logAuditTrail } = require('../services/auditTrailService');

dayjs.extend(utc);
dayjs.extend(timezone);

// Response codes
const RESPONSE_CODES = {
  SUCCESS: 1,
  VALIDATION_ERROR: 2,
  FAILED: 0,
  DUPLICATE: 3,
  NOT_FOUND: 4
};

const ISTFormat = (d) => (d ? dayjs(d).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null);

function safeParseInt(value, fallback = null) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function uploadImage(file, req) {
  if (!file || (!file.buffer && !file.path)) return "";

  const uploadDir = path.join(__dirname, "..", "public", "uploads", "products");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const ext = path.extname(file.originalname || file.path).toLowerCase();
  const basename = path.basename(file.originalname || file.path, ext)
    .replace(/\s+/g, "-")
    .replace(/\.+/g, "_");

  const filename = `${Date.now()}-${basename}${ext}`;
  const filepath = path.join(uploadDir, filename);

  if (file.buffer) {
    fs.writeFileSync(filepath, file.buffer);
  } else if (file.path) {
    fs.copyFileSync(file.path, filepath);
  }

  // 👇 Ab full URL return karenge
  return `${req.protocol}://${req.get("host")}/uploads/products/${filename}`;
}


function deleteImageIfExists(relativePath) {
  if (!relativePath) return;
  const publicDir = path.join(__dirname, '..', 'public');
  const imagePath = path.join(publicDir, relativePath);
  const normalized = path.normalize(imagePath);
  if (!normalized.startsWith(publicDir)) return;
  if (fs.existsSync(normalized)) {
    try { fs.unlinkSync(normalized); } catch (e) { }
  }
}


// Add product
exports.addProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg
    });
  }

  try {
    const category_id = safeParseInt(req.body.category_id);
    const name = (req.body.name || '').trim();
    const description = req.body.description || '';
    const status = req.body.status || 'Inactive';

    if (!category_id) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: 'Valid category_id is required'
      });
    }
    if (!name) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: 'Product name is required'
      });
    }

    const category = await prisma.product_categories.findUnique({ where: { id: category_id } });
    if (!category) {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Category not found'
      });
    }

    const existingProduct = await prisma.products.findFirst({
      where: {
        category_id,
        name: { equals: name, mode: 'insensitive' }
      }
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'Product with the same name already exists in this category.'
      });
    }

    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await prisma.products.findFirst({ where: { slug } });
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }

    // 👇 Image upload with full URL
    const imagePath = req.file ? uploadImage(req.file, req) : null;
function sanitizeBigInt(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}
    const product = await prisma.products.create({
      data: {
        category_id,
        name,
        slug,
        description,
        icon: imagePath, // yaha ab full URL save hoga
        status,
        created_at: new Date()
      }
    });

    await logAuditTrail({
      table_name: 'products',
      row_id: product.id,
      action: 'create',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Product "${product.name}" created`,
      status: product.status
    });

    return res.status(201).json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Product Added Successfully',
      product: sanitizeBigInt(product) // 👈 response me bhi product bhejna useful rahega
    });
  } catch (err) {
    console.error('addProduct error:', err);
    return res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Product could not be added'
    });
  }
};

// Get product list
exports.getProductList = async (req, res) => {
  try {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: errors.array()[0].msg,
      });
    }

    const offset = parseInt(req.body.offset) || 0; // page number
    const limit = parseInt(req.body.limit) || 10;

    const searchValue = (req.body.searchValue || '').trim();
    const validStatuses = ['Active', 'Inactive'];
    const statusFilter = validStatuses.includes(req.body.ProductCategoryStatus)
      ? req.body.ProductCategoryStatus
      : null;

    const where = {
      AND: [
        searchValue ? { name: { contains: searchValue, mode: 'insensitive' } } : null,
        statusFilter ? { status: statusFilter } : null
      ].filter(Boolean)
    };

    const total = await prisma.products.count();
    const filteredCount = await prisma.products.count({ where });

    const data = await prisma.products.findMany({
      where,
      skip: offset * limit,
      take: limit,
      orderBy: { id: 'asc' },
      include: {
        product_categories: { select: { id: true, name: true } }
      }
    });

    const formattedData = data.map(p => ({
      id: p.id.toString(),
      category_id: p.category_id.toString(),
      category_name: p.product_categories ? p.product_categories.name : null,
      name: p.name,
      slug: p.slug,
      description: p.description || null,
      icon: p.icon || null,
      status: p.status || null,
      created_at: p.created_at ? ISTFormat(p.created_at) : null,
      updated_at: p.updated_at ? ISTFormat(p.updated_at) : null
    }));

    return res.json({
      recordsTotal: total,
      recordsFiltered: filteredCount,
      data: formattedData

    });

  } catch (err) {
    console.error('getProductList error:', err);
    return res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Server error'
    });
  }
};


// Get product by ID
exports.getProductById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg,
    });
  }
  const id = safeParseInt(req.params.id);
  if (!id) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Product ID is required'
    });
  }

  try {
    const product = await prisma.products.findUnique({
      where: { id },
      include: { product_categories: { select: { id: true, name: true } } }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Product not found'
      });
    }

    const formattedProduct = {
      id: Number(product.id),
      category_id: Number(product.category_id),
      category_name: product.product_categories ? product.product_categories.name : null,
      name: product.name,
      slug: product.slug,
      description: product.description,
      icon: product.icon,
      status: product.status,
      created_at: ISTFormat(product.created_at),
      updated_at: ISTFormat(product.updated_at)
    };

    return res.json({
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Product fetched successfully',
      data: formattedProduct
    });
  } catch (err) {
    console.error('getProductById error:', err);
    return res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Server error'
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {

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
      message: 'Product ID is required',
    });
  }

  try {
    const {
      category_id: rawCategoryId,
      name: rawName,
      description = '',
      status = 'Inactive',
    } = req.body;

    const category_id = safeParseInt(rawCategoryId);
    const name = (rawName || '').trim();

    if (!category_id) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: 'Valid category_id is required',
      });
    }

    if (!name) {
      return res.status(422).json({
        success: false,
        statusCode: RESPONSE_CODES.VALIDATION_ERROR,
        message: 'Product name is required',
      });
    }

    const existing = await prisma.products.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Product not found',
      });
    }

    const isSame =
      Number(existing.category_id) === Number(category_id) &&
      existing.name.toLowerCase() === name.toLowerCase() &&
      (existing.description || '').trim() === description.trim() &&
      existing.status.toLowerCase() === status.toLowerCase() &&
      !req.file;

    if (isSame) {
      return res.status(200).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'Product is already updated with the same data',
      });
    }

    const duplicate = await prisma.products.findFirst({
      where: {
        id: { not: id },
        category_id,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'Another product with the same name exists in this category',
      });
    }

    const slug = slugify(name, { lower: true, strict: true });
    const updatePayload = {
      name,
      slug,
      description,
      status,
      updated_at: new Date(),
      category_id,
    };

    if (req.file) {
      const newImagePath = uploadImage(req.file);
      if (existing.icon) deleteImageIfExists(existing.icon);
      updatePayload.icon = newImagePath;
    }

    await prisma.products.update({
      where: { id },
      data: updatePayload,
    });


    await logAuditTrail({
      table_name: 'products',
      row_id: id,
      action: 'update',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Product "${name}" updated`,
      status
    });


    return res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Product updated successfully',
    });
  } catch (err) {
    console.error('updateProduct error:', err);
    return res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Failed to update product',
    });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg,
    });
  }
  const id = safeParseInt(req.params.id);
  if (!id) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Product ID is required'
    });
  }

  try {
    const product = await prisma.products.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Product not found'
      });
    }

    if (product.icon) deleteImageIfExists(product.icon);

    await prisma.products.delete({ where: { id } });

    await logAuditTrail({
      table_name: 'products',
      row_id: id,
      action: 'delete',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Product "${product.name}" deleted`,
      status: 'Deleted'
    });


    return res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Product deleted successfully'
    });
  } catch (err) {
    console.error('deleteProduct error:', err);
    return res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Failed to delete product'
    });
  }
};

// Change product status
exports.changeProductStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg,
    });
  }
  const id = safeParseInt(req.body.id);
  const status = req.body.status;

  if (!id) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Product ID is required'
    });
  }

  const validStatuses = ['Active', 'Inactive'];
  if (!validStatuses.includes(status)) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: 'Invalid status value'
    });
  }

  try {
    const product = await prisma.products.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Product not found'
      });
    }

    if (product.status === status) {
      return res.status(200).json({
        success: true,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: `Product status is already '${status}'. No update needed.`
      });
    }

    await prisma.products.update({
      where: { id },
      data: { status, updated_at: new Date() }
    });


    await logAuditTrail({
      table_name: 'products',
      row_id: id,
      action: 'update',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Product "${product.name}" status changed from "${product.status}" to "${status}"`,
      status
    });


    return res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Product status updated successfully'
    });
  } catch (err) {
    console.error('changeProductStatus error:', err);
    return res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Failed to update product status'
    });
  }
};
