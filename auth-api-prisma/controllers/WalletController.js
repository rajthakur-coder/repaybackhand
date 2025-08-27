const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { success, error } = require('../utils/response');
const { RESPONSE_CODES } = require('../utils/helper');

// 1. Get Wallet Details by User ID
exports.getWalletByUserId = async (req, res) => {
  const id = parseInt(req.user.id);

  if (isNaN(id)) {
    return error(res, 'Invalid user ID', RESPONSE_CODES.VALIDATION_ERROR, 422);
  }

  try {
    const wallet = await prisma.wallets.findUnique({ where: { user_id: id } });

    if (!wallet) {
      return error(res, 'Wallet not found', RESPONSE_CODES.NOT_FOUND, 404);
    }

    // total balance calculation
    const totalBalance = Number(wallet.balance || 0) + Number(wallet.free_balance || 0);

    return res.status(200).json({
      success: true,
      statusCode: 1,
      message: 'Wallet fetched successfully',
      data: {
        id: wallet.id.toString(),
        user_id: wallet.user_id.toString(),
        balance: wallet.balance,
        free_balance: wallet.free_balance,
        lien_balance: wallet.lien_balance,
        total_balance: totalBalance, // add total balance
        balance_expire_at: wallet.balance_expire_at, // raw date from DB
        created_at: wallet.created_at,               // raw date
        updated_at: wallet.updated_at,               // raw date
      }
    });

  } catch (err) {
    console.error(err);
    return error(res, 'Server error', RESPONSE_CODES.FAILED, 500);
  }
};
