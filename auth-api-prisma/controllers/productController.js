const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const slugify = require('slugify');
const { logAuditTrail } = require('../services/auditTrailService');
const { RESPONSE_CODES } = require('../utils/helper');
const { getNextSerial, reorderSerials } = require('../utils/serial');
const { success, error } = require('../utils/response');
const { safeParseInt, convertBigIntToString } = require('../utils/parser');
const { uploadImage, deleteImageIfExists } = require('../utils/fileUpload');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);
const ISTFormat = (d) => (d ? dayjs(d).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null);


const safeLogAuditTrail = async (params) => {
  try { await logAuditTrail(params); }
  catch (err) { console.error('Audit Trail Error (non-blocking):', err); }
};

//ADD PRODUCT 
exports.addProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

  try {
    const category_id = safeParseInt(req.body.category_id);
    const name = (req.body.name || '').trim();
    const description = req.body.description || '';
    const status = req.body.status || 'Inactive';

    // if (!category_id) return error(res, 'Product category Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    // if (!name) return error(res, 'Product Name is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

    const category = await prisma.product_categories.findUnique({ where: { id: category_id } });
    if (!category) return error(res, 'Category not found', RESPONSE_CODES.NOT_FOUND, 404);

    const existingProduct = await prisma.products.findFirst({
      where: { category_id, name: { equals: name, mode: 'insensitive' } }
    });
    if (existingProduct) return error(res, 'This product already exists', RESPONSE_CODES.DUPLICATE, 409);

    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await prisma.products.findFirst({ where: { slug } });
    if (slugExists) slug = `${slug}-${Date.now()}`;

    const imagePath = req.file ? uploadImage(req.file, req) : null;
    const nextSerial = await getNextSerial(prisma, 'products');

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.products.create({
        data: { category_id, name, slug, description, icon: imagePath, status, created_at: new Date(), serial_no: nextSerial }
      });

      safeLogAuditTrail({
        prisma: tx,
        table_name: 'products',
        row_id: created.id,
        action: 'create',
        user_id: req.user?.id || null,
        ip_address: req.ip,
        remark: `Product "${created.name}" created`,
        created_by: req.user?.id || null,
        status: created.status
      });

      return created;
    });

    return res.status(200).json({
      success: true,
      statusCode: 1,
      message: 'Product added successfully',
    });

  } catch (err) {
    console.error('addProduct error:', err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// GET PRODUCT LIST 
exports.getProductList = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(
        res,
        errors.array()[0].msg,
        RESPONSE_CODES.VALIDATION_ERROR,
        422
      );
    }

    const offset = safeParseInt(req.body.offset, 0);
    const limit = safeParseInt(req.body.limit, 10);
    const searchValue = (req.body.searchValue || '').trim();
    const statusRaw = req.body.ProductStatus || '';
    const statusFilter = statusRaw.toLowerCase();

    const validStatuses = ['active', 'inactive'];

    const where = {
      AND: [
        searchValue
          ? { name: { contains: searchValue, mode: 'insensitive' } }
          : null,
        validStatuses.includes(statusFilter)
          ? { status: { equals: statusFilter, mode: 'insensitive' } }
          : null
      ].filter(Boolean)
    };


    const [total, filteredCount, data] = await Promise.all([
      prisma.products.count(),
      prisma.products.count({ where }),
      prisma.products.findMany({
        where,
        skip: offset * limit,
        take: limit,
        orderBy: { serial_no: 'asc' },
        include: { product_categories: { select: { id: true, name: true } } }
      })
    ]);


    const formattedData = convertBigIntToString(data).map((p) => ({
      id: String(p.id),
      serial_no: safeParseInt(p.serial_no),
      category_id: p.category_id ? String(p.category_id) : null,
      category_name: p.product_categories
        ? p.product_categories.name
        : null,
      name: p.name,
      slug: p.slug,
      description: p.description || null,
      icon: p.icon || null,
      status: p.status || null,
      created_at: ISTFormat(p.created_at),
      updated_at: ISTFormat(p.updated_at)
    }));


    return res.status(200).json({
      success: true,
      statusCode: 1,
      message: 'Data fetched successfully',
      recordsTotal: total,
      recordsFiltered: filteredCount,
      data: formattedData
    });
  } catch (err) {
    console.error('getProductList error:', err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// GET PRODUCT BY ID 
exports.getProductById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

    const id = safeParseInt(req.params.id);

    const product = await prisma.products.findUnique({
      where: { id },
      include: { product_categories: { select: { id: true, name: true } } }
    });
    if (!product) return error(res, 'Product Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    const formattedProduct = convertBigIntToString({
      id: product.id,
      serial_no: product.serial_no,
      category_id: product.category_id,
      category_name: product.product_categories ? product.product_categories.name : null,
      name: product.name,
      slug: product.slug,
      description: product.description,
      icon: product.icon,
      status: product.status,
      created_at: ISTFormat(product.created_at),
      updated_at: ISTFormat(product.updated_at)
    });

    return res.status(200).json({
      success: true,
      statusCode: 1,
      message: 'Data fetched successfully',
      data: formattedProduct,
    });

  } catch (err) {
    console.error('getProductById error:', err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};

// UPDATE PRODUCT 
exports.updateProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

  const id = safeParseInt(req.params.id);
  if (!id) return error(res, 'Product ID is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

  try {
    const { category_id: rawCategoryId, name: rawName, description = '', status = 'Inactive' } = req.body;
    const category_id = safeParseInt(rawCategoryId);
    const name = (rawName || '').trim();

    if (!category_id) return error(res, 'Category ID is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
    if (!name) return error(res, 'Product name is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

    const existing = await prisma.products.findUnique({ where: { id } });
    if (!existing) return error(res, 'Product not found', RESPONSE_CODES.NOT_FOUND, 404);

    const isSame =
      safeParseInt(existing.category_id) === safeParseInt(category_id) &&
      existing.name.toLowerCase() === name.toLowerCase() &&
      (existing.description || '').trim() === description.trim() &&
      existing.status.toLowerCase() === status.toLowerCase() &&
      !req.file;

    if (isSame) return error(res, 'No changes detected, product is already up-to-date', RESPONSE_CODES.DUPLICATE, 409);

    const duplicate = await prisma.products.findFirst({
      where: { id: { not: id }, category_id, name: { equals: name, mode: 'insensitive' } }
    });
    if (duplicate) return error(res, 'Another product with the same name exists in this category', RESPONSE_CODES.DUPLICATE, 409);

    let slug = slugify(name, { lower: true, strict: true });
    const slugExists = await prisma.products.findFirst({ where: { id: { not: id }, slug } });
    if (slugExists) slug = `${slug}-${Date.now()}`;

    const updatePayload = { name, slug, description, status, updated_at: new Date(), category_id };
    if (req.file) { const newImagePath = uploadImage(req.file, req); if (existing.icon) deleteImageIfExists(existing.icon); updatePayload.icon = newImagePath; }

    await prisma.$transaction(async (tx) => {
      await tx.products.update({ where: { id }, data: updatePayload });
      safeLogAuditTrail({
        prisma: tx,
        table_name: 'products',
        row_id: id,
        action: 'update',
        user_id: req.user?.id || null,
        ip_address: req.ip,
        remark: `Product "${name}" updated`,
        updated_by: req.user?.id || null,
        status
      });
    });

    return success(res, 'Product updated successfully');


  } catch (err) {
    console.error('updateProduct error:', err);
    return error(res, 'Failed to update product', RESPONSE_CODES.FAILED, 500);
  }
};

// DELETE PRODUCT 
exports.deleteProduct = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

  const id = safeParseInt(req.params.id);

  try {
    const product = await prisma.products.findUnique({ where: { id } });
    if (!product) return error(res, 'Product Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    if (product.icon) deleteImageIfExists(product.icon);

    await prisma.$transaction(async (tx) => {
      await tx.products.delete({ where: { id } });
      await reorderSerials(tx, 'products');
      safeLogAuditTrail({
        prisma: tx,
        table_name: 'products',
        row_id: id,
        action: 'delete',
        user_id: req.user?.id || null,
        ip_address: req.ip,
        remark: `Product "${product.name}" deleted`,
        deleted_by: req.user?.id || null,
        status: 'Deleted'
      });
    });

    return success(res, 'Product deleted successfully');

  } catch (err) {
    console.error('deleteProduct error:', err);
    return error(res, 'Failed to delete Product', RESPONSE_CODES.FAILED, 500);
  }
};

// CHANGE PRODUCT STATUS 
// exports.changeProductStatus = async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

//   const id = safeParseInt(req.params.id);
//   const { status } = req.body;
//   if (!id) return error(res, 'Product Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

//   const validStatuses = ['Active', 'Inactive'];
//   if (!validStatuses.includes(status)) return error(res, 'Invalid status value', RESPONSE_CODES.VALIDATION_ERROR, 422);

//   try {
//     const product = await prisma.products.findUnique({ where: { id } });
//     if (!product) return error(res, 'Product Not Found', RESPONSE_CODES.NOT_FOUND, 404);
//     if (product.status === status) return error(res, 'Product status is already up-to-date', RESPONSE_CODES.DUPLICATE, 409);

//     await prisma.products.update({ where: { id }, data: { status, updated_at: new Date() } });

//     safeLogAuditTrail({
//       table_name: 'products',
//       row_id: id,
//       action: 'update',
//       user_id: req.user?.id || null,
//       ip_address: req.ip,
//       remark: `Product "${product.name}" status changed from "${product.status}" to "${status}"`,
//       updated_by: req.user?.id || null,
//       status
//     });

//     return success(res, 'Product status updated successfully');

//   } catch (err) {
//     console.error('changeProductStatus error:', err);
//     return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
//   }
// };


exports.changeProductStatus = async (req, res) => {
  const id = safeParseInt(req.params.id);
  if (!id || id <= 0) {
    return error(res, 'Product Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  try {
    // Fetch the product from DB
    const product = await prisma.products.findUnique({ where: { id } });
    if (!product) {
      return error(res, 'Product Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    // Toggle status: 'Active' <-> 'Inactive' (case-sensitive)
    const newStatus = product.status === 'Active' ? 'Inactive' : 'Active';

    // Update the status
    await prisma.products.update({
      where: { id },
      data: { status: newStatus, updated_at: new Date() },
    });

    // Log audit trail
    safeLogAuditTrail({
      table_name: 'products',
      row_id: id,
      action: 'update',
      user_id: req.user?.id || null,
      ip_address: req.ip,
      remark: `Product "${product.name}" status changed from "${product.status}" to "${newStatus}"`,
      updated_by: req.user?.id || null,
      status: newStatus
    });

    return success(res, `Product status changed to ${newStatus}`);

  } catch (err) {
    console.error('toggleProductStatus error:', err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};
