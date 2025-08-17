const { prisma } = require('../lib/prismaClient');
async function logAuditTrail({
  table_name = null,
  row_id = null,
  action = null,
  user_id = null,
  ip_address = null,
  latitude = null,
  longitude = null,
  remark = null,
  status = null
}) {
  if (!table_name || !action) throw new Error('table_name and action required');

  const now = new Date();

  const isCreate = action.toLowerCase() === 'create';
  const isUpdate = action.toLowerCase() === 'update';
  const isDelete = action.toLowerCase() === 'delete';

  const created_by = isCreate ? Number(user_id) : null;
  const created_at = isCreate ? now : null;

  const updated_by = isUpdate ? Number(user_id) : null;
  const updated_at = isUpdate ? now : null;

  const deleted_by = isDelete ? Number(user_id) : null;
  const deleted_at = isDelete ? now : null;

  try {
    return await prisma.$executeRaw`
      INSERT INTO audit_trail (
        table_name, row_id, action,
        created_by, created_at,
        updated_by, updated_at,
        deleted_by, deleted_at,
        ip_address, latitude, longitude,
        remark, status
      ) VALUES (
        ${table_name},
        ${row_id !== null ? Number(row_id) : null}, 
        ${action},
        ${created_by}, ${created_at},
        ${updated_by}, ${updated_at},
        ${deleted_by}, ${deleted_at},
        ${ip_address}, ${latitude}, ${longitude},
        ${remark}, ${status}
      )
    `;
  } catch (err) {
    console.error('Manual audit insert failed:', err);
    throw err;
  }
}

module.exports = { logAuditTrail };
