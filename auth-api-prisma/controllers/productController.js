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
const { RESPONSE_CODES } = require('../utils/helper');
const { getNextSerial, reorderSerials } = require('../utils/serial');
const { success, error } = require('../utils/response');



dayjs.extend(utc);
dayjs.extend(timezone);


const ISTFormat = (d) => (d ? dayjs(d).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null);

function safeParseInt(value, fallback = null) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function uploadImage(file, req) {
  if (!file || (!file.buffer && !file.path)) return "";

  const uploadDir = path.join(__dirname, "..", "uploads/products");
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
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

  }

  try {
    const category_id = safeParseInt(req.body.category_id);
    const name = (req.body.name || '').trim();
    const description = req.body.description || '';
    const status = req.body.status || 'Inactive';

    if (!category_id) {
      return error(res, 'product category Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

    }
    if (!name) {
      return error(res, 'product Name is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    const category = await prisma.product_categories.findUnique({ where: { id: category_id } });
    if (!category) {
      return error(res, 'Category not found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    const existingProduct = await prisma.products.findFirst({
      where: {
        category_id,
        name: { equals: name, mode: 'insensitive' }
      }
    });

    if (existingProduct) {
      return error(res, 'This product already exists', RESPONSE_CODES.DUPLICATE, 409);
    }

    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await prisma.products.findFirst({ where: { slug } });
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }


    const imagePath = req.file ? uploadImage(req.file, req) : null;
    function sanitizeBigInt(obj) {
      return JSON.parse(
        JSON.stringify(obj, (key, value) =>
          typeof value === 'bigint' ? Number(value) : value
        )
      );
    }
    // const product = await prisma.products.create({
    //   data: {
    //     category_id,
    //     name,
    //     slug,
    //     description,
    //     icon: imagePath, // yaha ab full URL save hoga
    //     status,
    //     created_at: new Date()
    //   }
    // });
    const nextSerial = await getNextSerial(prisma, 'products');

    const product = await prisma.products.create({
      data: {
        category_id,
        name,
        slug,
        description,
        icon: imagePath,
        status,
        created_at: new Date(),
        serial_no: nextSerial

      }
      // select: {
      //   id: true,
      //   category_id: true,
      //   name: true,
      //   slug: true,
      //   description: true,
      //   icon: true,
      //   status: true,
      //   created_at: true,
      //   serial_no: true   
      // }
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

    return success(res, 'Product added successfully', {
      product: sanitizeBigInt(product)
    });
  } catch (err) {
    console.error('addProduct error:', err);
    return error(res, 'Server error');

  }
};

// Get product list
exports.getProductList = async (req, res) => {
  try {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

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

    // const data = await prisma.products.findMany({
    //   where,
    //   skip: offset * limit,
    //   take: limit,
    //   orderBy: { id: 'asc' },
    //   include: {
    //     product_categories: { select: { id: true, name: true } }
    //   }
    // });

    const data = await prisma.products.findMany({
      where,
      skip: offset * limit,
      take: limit,
      orderBy: { serial_no: 'asc' },
      include: {
        product_categories: { select: { id: true, name: true } }
      }
    });


    // const formattedData = data.map(p => ({
    //   id: p.id.toString(),
    //   category_id: p.category_id.toString(),
    //   category_name: p.product_categories ? p.product_categories.name : null,
    //   name: p.name,
    //   slug: p.slug,
    //   description: p.description || null,
    //   icon: p.icon || null,
    //   status: p.status || null,
    //   created_at: p.created_at ? ISTFormat(p.created_at) : null,
    //   updated_at: p.updated_at ? ISTFormat(p.updated_at) : null
    // }));

    const formattedData = data.map(p => ({
      id: p.id.toString(),
      serial_no: p.serial_no,
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


    return success(res, 'Data fetched successfully', {
      recordsTotal: total,
      recordsFiltered: filteredCount,
      data: formattedData

    });

  } catch (err) {
    console.error('getProductList error:', err);
    return error(res, 'Server error');
  }
};


// Get product by ID
exports.getProductById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

  }
  const id = safeParseInt(req.params.id);
  if (!id) {
    return error(res, 'Product ID Not Found', RESPONSE_CODES.NOT_FOUND, 404);
  }


  try {
    const product = await prisma.products.findUnique({
      where: { id },
      include: { product_categories: { select: { id: true, name: true } } }
    });

    if (!product) {
      return error(res, 'Product Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    }

    // const formattedProduct = {
    //   id: Number(product.id),
    //   category_id: Number(product.category_id),
    //   category_name: product.product_categories ? product.product_categories.name : null,
    //   name: product.name,
    //   slug: product.slug,
    //   description: product.description,
    //   icon: product.icon,
    //   status: product.status,
    //   created_at: ISTFormat(product.created_at),
    //   updated_at: ISTFormat(product.updated_at)
    // };

    const formattedProduct = {
      id: Number(product.id),
      serial_no: product.serial_no,
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


    return success(res, 'Data fetched successfully', {

      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Product fetched successfully',
      data: formattedProduct
    });
  } catch (error) {
    console.error('getProductById error:', error);
    return error(res, 'Server error');

  }
};

// Update product
exports.updateProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const id = safeParseInt(req.params.id);
  if (!id) {
    return error(res, 'Product ID is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
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
      return error(res, 'Category ID is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    if (!name) {
      return error(res, 'Product name is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    const existing = await prisma.products.findUnique({ where: { id } });
    if (!existing) {
      return error(res, 'Product not found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    const isSame =
      Number(existing.category_id) === Number(category_id) &&
      existing.name.toLowerCase() === name.toLowerCase() &&
      (existing.description || '').trim() === description.trim() &&
      existing.status.toLowerCase() === status.toLowerCase() &&
      !req.file;

    if (isSame) {
      return error(res, 'No changes detected, product is already up-to-date', RESPONSE_CODES.DUPLICATE, 409);
    }

    // Duplicate name check
    const duplicate = await prisma.products.findFirst({
      where: {
        id: { not: id },
        category_id,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      return error(res, 'Another product with the same name exists in this category', RESPONSE_CODES.DUPLICATE, 409);
    }

    // Generate unique slug
    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await prisma.products.findFirst({
      where: { id: { not: id }, slug },
    });
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }


    const updatePayload = {
      name,
      slug,
      description,
      status,
      updated_at: new Date(),
      category_id,
    };


    if (req.file) {
      const newImagePath = uploadImage(req.file, req);
      if (existing.icon) deleteImageIfExists(existing.icon);
      updatePayload.icon = newImagePath;
    }

    await prisma.products.update({
      where: { id },
      data: updatePayload,
    });

    // Log audit trail
    await logAuditTrail({
      table_name: 'products',
      row_id: id,
      action: 'update',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Product "${name}" updated`,
      status,
    });

    return success(res, `Product updated successfully`);
  } catch (error) {
    console.error('updateProduct error:', error);
    return error(res, 'Failed to update product', RESPONSE_CODES.FAILED, 500);
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

  }
  const id = safeParseInt(req.params.id);
  if (!id) {
    return error(res, 'product Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

  }

  try {
    const product = await prisma.products.findUnique({ where: { id } });
    if (!product) {
      return error(res, 'Product Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    }

    if (product.icon) deleteImageIfExists(product.icon);

    await prisma.products.delete({ where: { id } });

    await reorderSerials(prisma, 'products');

    await logAuditTrail({
      table_name: 'products',
      row_id: id,
      action: 'delete',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Product "${product.name}" deleted`,
      status: 'Deleted'
    });


    return success(res, 'Product deleted successfully');

  } catch (error) {
    console.error('deleteProduct error:', error);
    return error(res, 'Failed to delete Product', RESPONSE_CODES.FAILED, 500);
  }
};

// Change product status
exports.changeProductStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const id = safeParseInt(req.params.id); // get id from params
  const { status } = req.body;

  if (!id) {
    return error(res, 'Product Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  const validStatuses = ['Active', 'Inactive'];
  if (!validStatuses.includes(status)) {
    return error(res, 'Invalid status value', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  try {
    const product = await prisma.products.findUnique({ where: { id } });
    if (!product) {
      return error(res, 'Product Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    if (product.status === status) {
      return error(res, 'Product status is already up-to-date', RESPONSE_CODES.DUPLICATE, 409);
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

    return success(res, 'Product status updated successfully');

  } catch (error) {
    console.error('changeProductStatus error:', error);
    return error(res, 'Server error');
  }
};
