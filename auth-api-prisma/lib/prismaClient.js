const { PrismaClient } = require('@prisma/client');
const { AsyncLocalStorage } = require('async_hooks');
const dayjs = require('dayjs');
const prisma = new PrismaClient();


const asyncLocalStorage = new AsyncLocalStorage();

function getRequestContext() {
  return asyncLocalStorage.getStore() || {};
}

function toNullableNumber(v) {
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function extractRowIdFromResult(result) {
  if (!result) return null;
  if (Array.isArray(result)) return null;
  if (typeof result === 'object') {
    return result.id ?? result.ID ?? null;
  }
  return null;
}

prisma.$extends({
  result: {
    allModels: {
      $allOperations: async (next, params) => {
        const result = await next(params);

        try {
          const model = params.model;   
          const action = params.action;
          const allowed = ['create', 'update', 'delete'];

          if (model && allowed.includes(action)) {
            const ctx = getRequestContext();
            const userId = ctx.userId ?? null;
            const ip = ctx.ip ?? null;
            const latitude = toNullableNumber(ctx.latitude);
            const longitude = toNullableNumber(ctx.longitude);
            const remark = ctx.remark ?? null;
            const status = ctx.status ?? null;

            const rowId = extractRowIdFromResult(result);
            const now = dayjs().format('YYYY-MM-DD HH:mm:ss');

            prisma.$executeRaw`
              INSERT INTO audit_trail (
                table_name, row_id, action, created_by, created_at,
                ip_address, latitude, longitude, remark, status
              ) VALUES (
                ${model},
                ${rowId},
                ${action},
                ${userId},
                ${now},
                ${ip},
                ${latitude},
                ${longitude},
                ${remark},
                ${status}
              )
            `.catch(e => {
              console.error('Audit middleware insert failed:', e);
            });
          }
        } catch (err) {
          console.error('Audit middleware error:', err);
        }

        return result;
      }
    }
  }
});

module.exports = { prisma, asyncLocalStorage, getRequestContext };
