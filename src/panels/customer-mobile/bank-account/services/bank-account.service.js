import { BankAccount } from '../../../../models/bank-account.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class CustomerBankAccountService {
  /**
   * Retrieves active linked bank accounts for a customer
   * @param {String} userId - Logged-in user ID
   */
  async getBankAccounts(userId) {
    return await BankAccount.find({ userId, isDeleted: false });
  }

  /**
   * Links a new bank account
   */
  async createBankAccount(userId, payload) {
    // 1. Check for duplicates
    const duplicate = await BankAccount.findOne({
      userId,
      accountNumber: payload.accountNumber.trim(),
      isDeleted: false
    });

    if (duplicate) {
      throw ApiError.badRequest('This bank account number is already linked to your profile.', ErrorCode.VALIDATION_ERROR);
    }

    // 2. Check if this is the user's first account
    const count = await BankAccount.countDocuments({ userId, isDeleted: false });
    const isPrimary = count === 0;

    const account = await BankAccount.create({
      userId,
      bankName: payload.bankName.trim(),
      accountNumber: payload.accountNumber.trim(),
      ifsc: payload.ifsc.toUpperCase().trim(),
      accountHolder: payload.accountHolder.trim(),
      isPrimary
    });

    return account;
  }

  /**
   * Updates an existing bank account
   */
  async updateBankAccount(userId, id, payload) {
    const account = await BankAccount.findOne({ _id: id, userId, isDeleted: false });
    if (!account) {
      throw ApiError.notFound('Bank account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Check duplicate account number if changed
    if (payload.accountNumber && payload.accountNumber !== account.accountNumber) {
      const duplicate = await BankAccount.findOne({
        userId,
        accountNumber: payload.accountNumber.trim(),
        isDeleted: false
      });
      if (duplicate) {
        throw ApiError.badRequest('Another linked account already uses this account number.', ErrorCode.VALIDATION_ERROR);
      }
    }

    if (payload.bankName) account.bankName = payload.bankName.trim();
    if (payload.accountNumber) account.accountNumber = payload.accountNumber.trim();
    if (payload.ifsc) account.ifsc = payload.ifsc.toUpperCase().trim();
    if (payload.accountHolder) account.accountHolder = payload.accountHolder.trim();

    await account.save();
    return account;
  }

  /**
   * Soft deletes a bank account
   */
  async deleteBankAccount(userId, id) {
    const account = await BankAccount.findOne({ _id: id, userId, isDeleted: false });
    if (!account) {
      throw ApiError.notFound('Bank account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const wasPrimary = account.isPrimary;
    account.isDeleted = true;
    account.isPrimary = false;
    await account.save();

    // If we deleted the primary account, assign another active account as primary
    if (wasPrimary) {
      const nextAccount = await BankAccount.findOne({ userId, isDeleted: false });
      if (nextAccount) {
        nextAccount.isPrimary = true;
        await nextAccount.save();
      }
    }

    return { success: true, message: 'Bank account successfully unlinked.' };
  }

  /**
   * Sets a specific account as primary for autopay routing
   */
  async setPrimaryAccount(userId, id) {
    const account = await BankAccount.findOne({ _id: id, userId, isDeleted: false });
    if (!account) {
      throw ApiError.notFound('Bank account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Set all other accounts to false
    await BankAccount.updateMany({ userId, isDeleted: false }, { isPrimary: false });

    // Set target account to true
    account.isPrimary = true;
    await account.save();

    return account;
  }
}

export const customerBankAccountService = new CustomerBankAccountService();
