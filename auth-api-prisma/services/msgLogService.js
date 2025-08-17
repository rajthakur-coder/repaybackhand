const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function logMessage({ api_id, numbers, message, base_url, params, api_response }) {
  return prisma.msg_logs.create({
    data: {
      api_id,
      numbers,
      message,
      base_url,
      params: JSON.stringify(params || {}),
      api_response: JSON.stringify(api_response || {}),
      created_at: new Date()
    }
  });
}

module.exports = { logMessage };
