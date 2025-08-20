const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validationResult } = require('express-validator');
const slugify = require('slugify');
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

const VALID_STATUS = ['Active', 'Inactive'];

function formatISTDate(date) {
    return date ? dayjs(date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null;
}

// Add Product Category
exports.addProductCategory = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

    const { name, status } = req.body;

    try {
        const existingCategory = await prisma.product_categories.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } },
        });
        if (existingCategory) return error(res, 'This Product Category already exists', RESPONSE_CODES.DUPLICATE, 409);

        const slug = `${slugify(name, { lower: true })}-${Date.now()}`;
        const dateObj = dayjs().tz('Asia/Kolkata').toDate();
        const nextSerial = await getNextSerial(prisma, 'product_categories');

        const newCategory = await prisma.product_categories.create({
            data: { name, slug, status, created_at: dateObj, serial_no: nextSerial },
        });

        logAuditTrail({
            table_name: 'product_categories',
            row_id: newCategory.id,
            action: 'create',
            user_id: req.user?.id ? Number(req.user.id) : null,
            ip_address: req.ip,
            remark: `Product category "${name}" created`,
            status,
        }).catch(err => console.error('Audit log failed:', err));


        return res.status(200).json({
            success: true,
            statusCode: 1,
            message: 'Product Category added successfully',
        });
    } catch (err) {
        console.error(err);
        return error(res, 'Failed to add Product Category');
    }
};

// Get list
exports.getProductCategoryList = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

    const offset = safeParseInt(req.body.offset, 0);
    const limit = safeParseInt(req.body.limit, 10);
    const searchValue = (req.body.searchValue || '').trim();
    const validStatuses = ['active', 'inactive'];
    const statusFilter = (req.body.ProductCategoryStatus || '').toLowerCase(); 

    const where = {
      AND: [
        searchValue
          ? { name: { contains: searchValue, mode: 'insensitive' } }
          : null,
        statusFilter && validStatuses.includes(statusFilter)
          ? { status: { equals: statusFilter === 'active' ? 'Active' : 'Inactive', mode: 'insensitive' } }
          : null
      ].filter(Boolean),
    };

    const skip = offset * limit;

    const [total, filteredCount, data] = await Promise.all([
      prisma.product_categories.count(),
      prisma.product_categories.count({ where }),
      prisma.product_categories.findMany({
        where,
        skip,
        take: limit,
        orderBy: { serial_no: 'asc' },
      }),
    ]);

    const safeData = convertBigIntToString(data);
    const formattedData = safeData.map((item, index) => ({
      id: safeParseInt(item.id),
      name: item.name,
      slug: item.slug,
      status: item.status,
      created_at: formatISTDate(item.created_at),
      updated_at: formatISTDate(item.updated_at),
      serial_no: item.serial_no ?? skip + index + 1,
    }));

    return res.status(200).json({
      success: true,
      statusCode: 1,
      message: 'Data fetched successfully',
      recordsTotal: total,
      recordsFiltered: filteredCount,
      data: formattedData,
    });

  } catch (err) {
    console.error('getProductCategoryList error:', err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};


// Get by ID
exports.getProductCategoryById = async (req, res) => {
    const id = safeParseInt(req.params.id);
    if (!id) return error(res, 'Product Category Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

    try {
        const category = await prisma.product_categories.findUnique({
            where: { id },
            select: { id: true, name: true, status: true, serial_no: true, created_at: true, updated_at: true },
        });
        if (!category) return error(res, 'Product Category not found', RESPONSE_CODES.NOT_FOUND, 404);

        return success(res, 'Data fetched successfully', {
            ...convertBigIntToString(category),
            created_at: formatISTDate(category.created_at),
            updated_at: formatISTDate(category.updated_at),
        });
    } catch (err) {
        console.error(err);
        return error(res, 'Server error');
    }
};

// Update category
exports.updateProductCategory = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

    const id = safeParseInt(req.params.id);
    const { name, status } = req.body;

    if (!id || isNaN(id) || id <= 0) return error(res, 'Invalid or missing Product Category ID', RESPONSE_CODES.VALIDATION_ERROR, 422);

    try {
        const category = await prisma.product_categories.findUnique({ where: { id } });
        if (!category) return error(res, 'Product Category not found', RESPONSE_CODES.NOT_FOUND, 404);

        const duplicateName = await prisma.product_categories.findFirst({
            where: { name: { equals: name, mode: 'insensitive' }, id: { not: id } },
        });
        if (duplicateName) return error(res, 'This Product Category already exists', RESPONSE_CODES.DUPLICATE, 409);

        const slug = `${slugify(name, { lower: true })}-${Date.now()}`;
        const updatedAt = dayjs().tz('Asia/Kolkata').toDate();

        await prisma.product_categories.update({
            where: { id },
            data: { name, slug, status, updated_at: updatedAt },
        });

        logAuditTrail({
            table_name: 'product_categories',
            row_id: id,
            action: 'update',
            user_id: req.user?.id ? Number(req.user.id) : null,
            ip_address: req.ip,
            remark: `Product category "${name}" updated`,
            status,
        }).catch(err => console.error('Audit log failed:', err));

        return success(res, 'Product Category updated successfully');
    } catch (err) {
        console.error(err);
        return error(res, 'Server error');
    }
};

// Delete category
exports.deleteProductCategory = async (req, res) => {
    const id = safeParseInt(req.params.id);

    try {
        const relatedProducts = await prisma.products.count({ where: { category_id: id } });
        if (relatedProducts > 0) return error(res, 'Cannot delete Product Category with assigned products', RESPONSE_CODES.FAILED, 400);

        await prisma.$transaction(async (tx) => {
            await tx.product_categories.delete({ where: { id } });
            await reorderSerials(tx, 'product_categories');

            logAuditTrail({
                table_name: 'product_categories',
                row_id: id,
                action: 'delete',
                user_id: req.user?.id ? Number(req.user.id) : null,
                ip_address: req.ip,
                remark: `Product category deleted`,
                status: 'DELETED',
            }).catch(err => console.error('Audit log failed:', err));
        });

        return success(res, 'Product Category deleted successfully');
    } catch (err) {
        console.error(err);
        return error(res, 'Product Category Not Found', RESPONSE_CODES.NOT_FOUND, 404);
    }
};

// Change status
exports.changeProductCategoryStatus = async (req, res) => {
    const id = safeParseInt(req.params.id);
    const { status } = req.body;

    if (!id || isNaN(id) || id <= 0) return error(res, 'Invalid or missing product category ID', RESPONSE_CODES.VALIDATION_ERROR, 422);

    try {
        const existingCategory = await prisma.product_categories.findUnique({ where: { id } });
        if (!existingCategory) return error(res, 'Product Category Not Found', RESPONSE_CODES.NOT_FOUND, 404);
        if (existingCategory.status === status) return error(res, 'Product category status is already the same', RESPONSE_CODES.DUPLICATE, 409);

        await prisma.product_categories.update({ where: { id }, data: { status } });

        logAuditTrail({
            table_name: 'product_categories',
            row_id: id,
            action: 'status_change',
            user_id: req.user?.id ? Number(req.user.id) : null,
            ip_address: req.ip,
            remark: `Status changed to ${status}`,
            status,
        }).catch(err => console.error('Audit log failed:', err));

        return success(res, 'Product Category status updated successfully');
    } catch (err) {
        console.error(err);
        return error(res, 'Server error');
    }
};