import { SupportSetting } from '../../../../../models/support-setting.model.js';

export class SupportSettingsService {
  /**
   * Retrieves the current support settings or auto-initializes defaults
   */
  async getSupportSettings() {
    let settings = await SupportSetting.findOne().lean();
    if (!settings) {
      settings = await SupportSetting.findOneAndUpdate(
        {},
        {},
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();
    }
    return settings;
  }

  /**
   * Updates support settings
   */
  async updateSupportSettings(payload, updaterId) {
    const updateData = {
      ...payload,
      updatedBy: updaterId
    };

    const settings = await SupportSetting.findOneAndUpdate(
      {},
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    return settings;
  }
}

export const supportSettingsService = new SupportSettingsService();
