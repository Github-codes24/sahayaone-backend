import { ApiError } from "../../common/api.error.js";
import { Bank } from "../../models/bank.model.js";

export const requireSipBankOwner = async (req, res, next) => {
  try {
    // 1. Check user
    if (!req.user?.id) {
      return next(
        ApiError.unauthorized("User identity not loaded. Access denied.")
      );
    }

    // 2. Check bank context
    if (!req.society?.bankId) {
      return next(
        ApiError.unauthorized("Bank context not resolved. Access denied.")
      );
    }

    // 3. Find the bank
    const bank = await Bank.findOne({
      _id: req.society.bankId,
      isDeleted: { $ne: true },
    })
      .select("_id userId status")
      .lean();

    // 4. Bank not found
    if (!bank) {
      return next(
        ApiError.forbidden(
          "Bank not found. SIP scheme management is not allowed."
        )
      );
    }

    // 5. Check actual bank owner
    const isBankOwner =
      bank.userId &&
      String(bank.userId) === String(req.user.id);

    if (!isBankOwner) {
      return next(
        ApiError.forbidden(
          "Access denied. Only the Bank Owner can manage SIP schemes."
        )
      );
    }

    // 6. Check bank status
    const bankStatus = String(bank.status || "").toUpperCase();

    if (!["APPROVED", "ACTIVE"].includes(bankStatus)) {
      return next(
        ApiError.forbidden(
          `Bank status is ${bank.status}. SIP scheme management is not allowed.`
        )
      );
    }

    // 7. Everything is correct
    next();

  } catch (error) {
    next(error);
  }
};