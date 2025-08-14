const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');

exports.getMessageLogs = async (req, res) => {
  try {
    const { startDate, endDate, offset = 0, limit = 10 } = req.body;

    const where = {};

    if (startDate && endDate) {
      where.created_at = {
        gte: dayjs(startDate, 'DD-MM-YYYY').startOf('day').toDate(),
        lte: dayjs(endDate, 'DD-MM-YYYY').endOf('day').toDate()
      };
    } else if (startDate) {
      where.created_at = {
        gte: dayjs(startDate, 'DD-MM-YYYY').startOf('day').toDate()
      };
    } else if (endDate) {
      where.created_at = {
        lte: dayjs(endDate, 'DD-MM-YYYY').endOf('day').toDate()
      };
    }

    const total = await prisma.msg_logs.count();
    const filteredCount = await prisma.msg_logs.count({ where });

    const logs = await prisma.msg_logs.findMany({
      where,
      skip: offset * limit,
      take: limit,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        api_id: true,
        numbers: true,
        message: true,
        base_url: true,
        params: true,
        api_response: true,
        created_at: true
      }
    });

    const serialized = logs.map(log => ({
      ...log,
      id: Number(log.id),
      created_at: log.created_at
        ? dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')
        : null
    }));

    res.json({
      recordsTotal: total,
      recordsFiltered: filteredCount,
      data: serialized
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};
