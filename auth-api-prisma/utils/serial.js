// utils/serial.js
async function getNextSerial(prisma, model) {
  const maxSerial = await prisma[model].aggregate({ _max: { serial_no: true } });
  return (maxSerial._max.serial_no || 0) + 1;
}

async function reorderSerials(prisma, model) {
  const all = await prisma[model].findMany({ orderBy: { serial_no: 'asc' } });
  for (let i = 0; i < all.length; i++) {
    await prisma[model].update({
      where: { id: all[i].id },
      data: { serial_no: i + 1 }
    });
  }
}

module.exports = { getNextSerial, reorderSerials };
