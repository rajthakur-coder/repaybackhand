const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { validationResult } = require('express-validator');
const slugify = require('slugify');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { logAuditTrail } = require('../services/auditTrailService');

dayjs.extend(utc);
dayjs.extend(timezone);

// Response Codes
const RESPONSE_CODES = {
    SUCCESS: 1,
    VALIDATION_ERROR: 2,
    FAILED: 0,
    DUPLICATE: 3,
    NOT_FOUND: 4
};

// Format date to IST string
function formatISTDate(date) {
    return date ? dayjs(date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null;
}

// Add new category
exports.addProductCategory = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            success: false,
            statusCode: RESPONSE_CODES.VALIDATION_ERROR,
            message: errors.array()[0].msg
        });
    }

    const { name, status } = req.body;

    try {
        const slug = slugify(name, { lower: true });
        const dateObj = dayjs().tz('Asia/Kolkata').toDate();

        const existingCategory = await prisma.product_categories.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        });

        if (existingCategory) {
            return res.status(409).json({
                success: false,
                statusCode: RESPONSE_CODES.DUPLICATE,
                message: 'Product Category already added'
            });
        }

        // Pehle category create karo aur result store karo
        const newCategory = await prisma.product_categories.create({
            data: { name, slug, status, created_at: dateObj }
        });

        // Audit Trail - CREATE
        await logAuditTrail({
            table_name: 'product_categories',
            row_id: newCategory.id, // naya id use karna zaroori hai
            action: 'create',
            user_id: req.user?.id || null,
            ip_address: req.ip,
            remark: `Product category "${name}" created`,
            status
        });

        res.status(200).json({
            success: true,
            statusCode: RESPONSE_CODES.SUCCESS,
            message: 'Product Category Added Successfully'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            statusCode: RESPONSE_CODES.FAILED,
            message: 'Product Category could not be added'
        });
    }
};

// Get list 
exports.getProductCategoryList = async (req, res) => {
    const offset = parseInt(req.body.offset) || 0;
    const limit = parseInt(req.body.limit) || 10;
    const searchValue = req.body.searchValue || '';
    const validStatuses = ['Active', 'Inactive'];
    const statusFilter = validStatuses.includes(req.body.ProductCategoryStatus)
        ? req.body.ProductCategoryStatus
        : null;

    try {
        const total = await prisma.product_categories.count();

        const where = {
            AND: [
                searchValue ? { name: { contains: searchValue, mode: 'insensitive' } } : null,
                statusFilter ? { status: statusFilter } : null
            ].filter(Boolean)
        };

        const filteredCount = await prisma.product_categories.count({ where });

        const skip = offset * limit;
        const data = await prisma.product_categories.findMany({
            where,
            skip,
            take: limit,
            orderBy: { id: 'asc' }
        });

        const formattedData = data.map(item => ({
            ...item,
            id: Number(item.id),
            created_at: formatISTDate(item.created_at),
            updated_at: formatISTDate(item.updated_at)
        }));

        res.json({
            recordsTotal: total,
            recordsFiltered: filteredCount,
            data: formattedData
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            statusCode: RESPONSE_CODES.FAILED,
            message: 'Server error'
        });
    }
};

// Get category by ID
exports.getProductCategoryById = async (req, res) => {
    const id = parseInt(req.params.id);

    if (!id) {
        return res.status(400).json({
            statusCode: RESPONSE_CODES.VALIDATION_ERROR,
            message: 'Id is required'
        });
    }

    try {
        const category = await prisma.product_categories.findUnique({
            where: { id },
            select: { id: true, name: true, status: true, created_at: true, updated_at: true }
        });

        if (!category) {
            return res.status(404).json({
                statusCode: RESPONSE_CODES.NOT_FOUND,
                message: 'Invalid id found'
            });
        }

        res.json({
            statusCode: RESPONSE_CODES.SUCCESS,
            message: 'Data fetched successfully',
            data: {
                ...category,
                id: Number(category.id),
                created_at: formatISTDate(category.created_at),
                updated_at: formatISTDate(category.updated_at)
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            statusCode: RESPONSE_CODES.FAILED,
            message: 'Server error'
        });
    }
};

//  Update category
exports.updateProductCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      statusCode: RESPONSE_CODES.VALIDATION_ERROR,
      message: errors.array()[0].msg,
    });
  }

  const { id, name, status } = req.body;

  try {
    const category = await prisma.product_categories.findUnique({
      where: { id: Number(id) },
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        statusCode: RESPONSE_CODES.NOT_FOUND,
        message: 'Product Category Not Found',
      });
    }

    const duplicateName = await prisma.product_categories.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        id: { not: Number(id) },
      },
    });

    if (duplicateName) {
      return res.status(409).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'Another category with the same name exists',
      });
    }

    const slug = slugify(name, { lower: true });
    const updatedAt = dayjs().tz('Asia/Kolkata').toDate();

    if (
      category.name.toLowerCase() === name.toLowerCase() &&
      category.slug === slug &&
      category.status === status
    ) {
      return res.status(200).json({
        success: false,
        statusCode: RESPONSE_CODES.DUPLICATE,
        message: 'Product category already updated',
      });
    }

    await prisma.product_categories.update({
      where: { id: Number(id) },
      data: { name, slug, status, updated_at: updatedAt },
    });

    // Audit Trail - UPDATE
    await logAuditTrail({
      table_name: 'product_categories',
      row_id: Number(category.id), 
      action: 'update',
      user_id: req.user?.id ? Number(req.user.id) : null,
      ip_address: req.ip,
      remark: `Product category "${name}" updated`,
      status,
    });

    res.json({
      success: true,
      statusCode: RESPONSE_CODES.SUCCESS,
      message: 'Product category updated successfully',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      statusCode: RESPONSE_CODES.FAILED,
      message: 'Server error',
    });
  }
};

// Delete category
exports.deleteProductCategory = async (req, res) => {
    const id = parseInt(req.params.id);

    if (!id) {
        return res.status(422).json({
            success: false,
            statusCode: RESPONSE_CODES.VALIDATION_ERROR,
            message: 'Id is required'
        });
    }

    try {
        const relatedProducts = await prisma.products.count({
            where: { category_id: id }
        });
        if (relatedProducts > 0) {
            return res.status(400).json({
                success: false,
                statusCode: RESPONSE_CODES.FAILED,
                message: 'Cannot delete category with assigned products'
            });
        }

        await prisma.product_categories.delete({ where: { id } });

        // Audit Trail - DELETE
await logAuditTrail({
    table_name: 'product_categories',
    row_id: id,
    action: 'delete',
    user_id: req.user?.id,
    ip_address: req.ip,
    remark: `Product category deleted`,
    status: 'Deleted'
});

        res.json({
            success: true,
            statusCode: RESPONSE_CODES.SUCCESS,
            message: 'Product category deleted successfully'
        });

    } catch (err) {
        console.error(err);
        res.status(404).json({
            success: false,
            statusCode: RESPONSE_CODES.NOT_FOUND,
            message: 'Product Category Not found'
        });
    }
};

exports.changeProductCategoryStatus = async (req, res) => {
    const { id, status } = req.body;

    if (!id || isNaN(id) || parseInt(id) <= 0) {
        return res.status(400).json({
            success: false,
            statusCode: RESPONSE_CODES.VALIDATION_ERROR,
            message: 'Invalid or missing product category ID'
        });
    }

    const validStatuses = ['Active', 'Inactive'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            statusCode: RESPONSE_CODES.VALIDATION_ERROR,
            message: 'Invalid status value'
        });
    }

    try {
        const existingCategory = await prisma.product_categories.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                statusCode: RESPONSE_CODES.NOT_FOUND,
                message: 'Product category not found'
            });
        }

        if (existingCategory.status === status) {
            return res.status(200).json({
                success: true,
                statusCode: RESPONSE_CODES.SUCCESS,
                message: `Product category status is already '${status}'. No update needed.`
            });
        }

        await prisma.product_categories.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        // Audit Trail - STATUS CHANGE
await logAuditTrail({
    table_name: 'product_categories',
    row_id: id,
    action: "status_change",
    user_id: req.user?.id,
    ip_address: req.ip,
    remark: `Status changed to ${status}`,
    status
});

        res.json({
            success: true,
            statusCode: RESPONSE_CODES.SUCCESS,
            message: 'Product category status updated successfully'
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            statusCode: RESPONSE_CODES.FAILED,
            message: 'Failed to update product category status'
        });
    }
};

