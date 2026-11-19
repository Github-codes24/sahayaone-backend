import { BaseController } from '../../../../common/base.controller.js';
import { onboardingTeamService } from '../services/onboarding-team.service.js';

export class OnboardingTeamController extends BaseController {
  constructor() {
    super();
    this.list = this.catchAsync(this.list.bind(this));
    this.getById = this.catchAsync(this.getById.bind(this));
    this.create = this.catchAsync(this.create.bind(this));
    this.update = this.catchAsync(this.update.bind(this));
    this.delete = this.catchAsync(this.delete.bind(this));
    this.getFilterDropdowns = this.catchAsync(this.getFilterDropdowns.bind(this));
  }

  async list(req, res, next) {
    const result = await onboardingTeamService.listOnboardingTeam(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Onboarding Team members list retrieved successfully.');
  }

  async getById(req, res, next) {
    const result = await onboardingTeamService.getOnboardingTeamById(req.params.id);
    return this.sendResponse(res, 200, result, 'Onboarding Team member details retrieved successfully.');
  }

  async create(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await onboardingTeamService.createOnboardingTeam(req.body, req.file || null, creatorId);
    return this.sendCreated(res, result, 'Onboarding Team member created successfully.');
  }

  async update(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await onboardingTeamService.updateOnboardingTeam(req.params.id, req.body, req.file || null, updaterId);
    return this.sendResponse(res, 200, result, 'Onboarding Team member updated successfully.');
  }

  async delete(req, res, next) {
    const deleterId = req.user?.id || null;
    await onboardingTeamService.deleteOnboardingTeam(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Onboarding Team member deleted successfully.');
  }

  async getFilterDropdowns(req, res, next) {
    const result = await onboardingTeamService.getFilterDropdowns();
    return this.sendResponse(res, 200, result, 'Filter dropdown options retrieved successfully.');
  }
}

export const onboardingTeamController = new OnboardingTeamController();
