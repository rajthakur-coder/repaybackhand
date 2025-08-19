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




dayjs.extend(utc);
dayjs.extend(timezone);


// Format date to IST string
function formatISTDate(date) {
    return date ? dayjs(date).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss') : null;
}

// Add new category
function serializeBigInt(obj) {
    return JSON.parse(
        JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        )
    );
}

exports.addProductCategory = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);

    }

    const { name, status } = req.body;

    try {
        const slug = slugify(name, { lower: true });
        const dateObj = dayjs().tz('Asia/Kolkata').toDate();

        const existingCategory = await prisma.product_categories.findFirst({
            where: { name: { equals: name, mode: 'insensitive' } }
        });

        if (existingCategory) {
            return error(res, 'This Product Category already exists', RESPONSE_CODES.DUPLICATE, 409);

        }

        // 🔥 Get max serial_no and add +1
        const nextSerial = await getNextSerial(prisma, 'product_categories');


        const newCategory = await prisma.product_categories.create({
            data: {
                name,
                slug,
                status,
                created_at: dateObj,
                serial_no: nextSerial,
                serial_no: nextSerial

            }
        });

        await logAuditTrail({
            table_name: 'product_categories',
            row_id: newCategory.id,
            action: 'create',
            user_id: req.user?.id || null,
            ip_address: req.ip,
            remark: `Product category "${name}" created`,
            status
        });

        // Send only ONE response with BigInt handled
        return success(res, 'Product Category Added Successfully', {
            data: serializeBigInt(newCategory)
        });

    } catch (error) {
        console.error(error);
        return error(res, 'Failed to add Product Category');

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
            orderBy: { serial_no: 'asc' }
        });


        // const formattedData = data.map(item => ({
        //     ...item,
        //     id: Number(item.id),
        //     serial_no: item.serial_no,
        //     created_at: formatISTDate(item.created_at),
        //     updated_at: formatISTDate(item.updated_at)
        // }));

          const formattedData = data.map((item) => ({
            id: Number(item.id),
            name: item.name,
            slug: item.slug,
            status: item.status,
            created_at: formatISTDate(item.created_at),
            updated_at: formatISTDate(item.updated_at),
            serial_no: item.serial_no // agar null hai to auto-generate karo
        }));


      return res.status(200).json({
    success: true,
    statusCode: 1,
    message: 'Data fetched successfully',
    recordsTotal: total,
    recordsFiltered: filteredCount,
    data: formattedData
});


    } catch (error) {
        console.error(error);
        return error(res, 'Server error');

    }
};

// Get category by ID
exports.getProductCategoryById = async (req, res) => {
    const id = parseInt(req.params.id);

    if (!id) {
        return error(res, 'Product Category Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

    }

    try {
        const category = await prisma.product_categories.findUnique({
            where: { id },
            select: { id: true, name: true, status: true, serial_no: true, created_at: true, updated_at: true }

        });

        if (!category) {
            return res.status(404).json({
                statusCode: RESPONSE_CODES.NOT_FOUND,
                message: 'Product Category not found'
            });
        }

        return success(res, 'Data fetched successfully', {

            ...category,
            id: Number(category.id),
            created_at: formatISTDate(category.created_at),
            updated_at: formatISTDate(category.updated_at)

        });

    } catch (error) {
        console.error(error);
        return error(res, 'Server error');
    }
};


//  Update category
exports.updateProductCategory = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return error(res, errors.array()[0].msg, RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    const id = parseInt(req.params.id);
    const { name, status } = req.body;

    if (!id || isNaN(id) || id <= 0) {
        return error(res, 'Invalid or missing Product Category ID', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    try {
        const category = await prisma.product_categories.findUnique({
            where: { id },
        });

        if (!category) {
            return error(res, 'Product Category not found', RESPONSE_CODES.NOT_FOUND, 404);
        }

        const duplicateName = await prisma.product_categories.findFirst({
            where: {
                name: { equals: name, mode: 'insensitive' },
                id: { not: id },
            },
        });

        if (duplicateName) {
            return error(res, 'This Product Category already exists', RESPONSE_CODES.DUPLICATE, 409);
        }

        const slug = slugify(name, { lower: true });
        const updatedAt = dayjs().tz('Asia/Kolkata').toDate();

        if (
            category.name.toLowerCase() === name.toLowerCase() &&
            category.slug === slug &&
            category.status === status
        ) {
            return error(res, 'No changes detected, category is already up-to-date', RESPONSE_CODES.DUPLICATE, 409);
        }

        await prisma.product_categories.update({
            where: { id },
            data: { name, slug, status, updated_at: updatedAt },
        });

        await logAuditTrail({
            table_name: 'product_categories',
            row_id: id,
            action: 'update',
            user_id: req.user?.id ? Number(req.user.id) : null,
            ip_address: req.ip,
            remark: `Product category "${name}" updated`,
            status,
        });

        return success(res, 'Product Category updated successfully');
    } catch (err) {
        console.error(err);
        return error(res, 'Server error');
    }
};

// Delete category
exports.deleteProductCategory = async (req, res) => {
    const id = parseInt(req.params.id);

    if (!id) {
        return error(res, 'Product Category Id is required', RESPONSE_CODES.VALIDATION_ERROR, 422);

    }

    try {
        //  Check if category has related products
        const relatedProducts = await prisma.products.count({
            where: { category_id: id }
        });
        if (relatedProducts > 0) {
            return res.status(400).json({
                success: false,
                statusCode: RESPONSE_CODES.FAILED,
                message: 'Cannot delete Product Category with assigned products'
            });
        }

        await prisma.product_categories.delete({ where: { id } });

        // Reorder serial numbers (continuous numbering)
        await reorderSerials(prisma, 'product_categories');

        // Log audit trail
        await logAuditTrail({
            table_name: 'product_categories',
            row_id: id,
            action: 'delete',
            user_id: req.user?.id,
            ip_address: req.ip,
            remark: `Product category deleted`,
            status: 'Deleted'
        });

        // Send response
        return success(res, 'Product Category deleted successfully');


    } catch (error) {
        console.error(error);
        return error(res, 'Product Category Not Found', RESPONSE_CODES.NOT_FOUND, 404);

    }
};

//CHANGE STATUS
exports.changeProductCategoryStatus = async (req, res) => {
    const id = parseInt(req.params.id); // id from URL params
    const { status } = req.body;

    // Validate ID
    if (!id || isNaN(id) || id <= 0) {
        return error(res, 'Invalid or missing product category ID', RESPONSE_CODES.VALIDATION_ERROR, 422);
    }

    // Validate status
    const validStatuses = ['Active', 'Inactive'];
    if (!validStatuses.includes(status)) {
        return error(res, 'Invalid status value', RESPONSE_CODES.NOT_FOUND, 404);
    }

    try {
        // Check if category exists
        const existingCategory = await prisma.product_categories.findUnique({
            where: { id }
        });

        if (!existingCategory) {
            return error(res, 'Product Category Not Found', RESPONSE_CODES.NOT_FOUND, 404);
        }

        // Check if status is already the same
        if (existingCategory.status === status) {
            return error(res, 'Product category status is already the same. No update needed.', RESPONSE_CODES.DUPLICATE, 409);
        }

        // Update status
        await prisma.product_categories.update({
            where: { id },
            data: { status }
        });

        // Log audit trail
        await logAuditTrail({
            table_name: 'product_categories',
            row_id: id,
            action: "status_change",
            user_id: req.user?.id,
            ip_address: req.ip,
            remark: `Status changed to ${status}`,
            status
        });

        return success(res, 'Product Category status updated successfully');

    } catch (error) {
        console.error(error);
        return error(res, 'Server error');
    }
};
