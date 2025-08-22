
// Get the next serial number (transaction-safe)
async function getNextSerial(prismaOrTx, model) {
  const maxSerial = await prismaOrTx[model].aggregate({
    _max: { serial_no: true }
  });
  return (maxSerial._max.serial_no || 0) + 1;
}

// Reorder serial numbers (transaction-safe)
async function reorderSerials(prismaOrTx, model) {
  const all = await prismaOrTx[model].findMany({ orderBy: { serial_no: 'asc' } });

  for (let i = 0; i < all.length; i++) {
    await prismaOrTx[model].update({
      where: { id: all[i].id },
      data: { serial_no: i + 1 }
    });
  }
}

module.exports = { getNextSerial, reorderSerials };
