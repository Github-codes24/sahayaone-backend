import { BaseController } from '../../../../common/base.controller.js';
import { customerBankAccountService } from '../services/bank-account.service.js';

export class CustomerBankAccountController extends BaseController {
  constructor() {
    super();
    this.list = this.catchAsync(this.list.bind(this));
    this.create = this.catchAsync(this.create.bind(this));
    this.update = this.catchAsync(this.update.bind(this));
    this.delete = this.catchAsync(this.delete.bind(this));
    this.setPrimary = this.catchAsync(this.setPrimary.bind(this));
  }

  async list(req, res, next) {
    const userId = req.user.id;
    const accounts = await customerBankAccountService.getBankAccounts(userId);
    return this.sendResponse(res, 200, accounts, 'Bank accounts list retrieved successfully.');
  }

  async create(req, res, next) {
    const userId = req.user.id;
    const account = await customerBankAccountService.createBankAccount(userId, req.body);
    return this.sendResponse(res, 201, account, 'Bank account successfully linked.');
  }

  async update(req, res, next) {
    const userId = req.user.id;
    const { id } = req.params;
    const account = await customerBankAccountService.updateBankAccount(userId, id, req.body);
    return this.sendResponse(res, 200, account, 'Bank account successfully updated.');
  }

  async delete(req, res, next) {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await customerBankAccountService.deleteBankAccount(userId, id);
    return this.sendResponse(res, 200, result, 'Bank account successfully unlinked.');
  }

  async setPrimary(req, res, next) {
    const userId = req.user.id;
    const { id } = req.params;
    const account = await customerBankAccountService.setPrimaryAccount(userId, id);
    return this.sendResponse(res, 200, account, 'Primary bank account updated successfully.');
  }
}

export const customerBankAccountController = new CustomerBankAccountController();
