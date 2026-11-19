import { PriceSetting } from '../../../../../models/price-setting.model.js';
import { Setting } from '../../../../../models/setting.model.js';

export class PriceSettingsService {
  /**
   * Retrieves the current price settings or auto-initializes defaults
   */
  async getPriceSettings() {
    const [
      emiChargesSetting,
      emiPriceSetting,
      verifSetting,
      minEmiSetting,
      minVerifSetting,
      priceSettingDoc,
    ] = await Promise.all([
      Setting.findOne({ key: 'EMI_CARD_CHARGES' }).lean(),
      Setting.findOne({ key: 'EMI_CARD_PRICE' }).lean(),
      Setting.findOne({ key: 'VERIFICATION_CREDIT_PRICE' }).lean(),
      Setting.findOne({ key: 'MIN_EMI_CARD_LIMIT' }).lean(),
      Setting.findOne({ key: 'MIN_VERIFICATION_CREDIT_LIMIT' }).lean(),
      PriceSetting.findOne().lean(),
    ]);

    const emiCardPriceForBank =
      (emiChargesSetting?.value !== undefined ? Number(emiChargesSetting.value) : undefined) ??
      (emiPriceSetting?.value !== undefined ? Number(emiPriceSetting.value) : undefined) ??
      priceSettingDoc?.emiCardPriceForBank ??
      499;

    const emiCardMinPurchaseQuantity =
      (minEmiSetting?.value !== undefined ? Number(minEmiSetting.value) : undefined) ??
      priceSettingDoc?.emiCardMinPurchaseQuantity ??
      100;

    const verificationCreditPriceForBank =
      (verifSetting?.value !== undefined ? Number(verifSetting.value) : undefined) ??
      priceSettingDoc?.verificationCreditPriceForBank ??
      50;

    const verificationCreditMinPurchaseQuantity =
      (minVerifSetting?.value !== undefined ? Number(minVerifSetting.value) : undefined) ??
      priceSettingDoc?.verificationCreditMinPurchaseQuantity ??
      200;

    return {
      _id: priceSettingDoc?._id || null,
      emiCardPriceForBank,
      emiCardMinPurchaseQuantity,
      verificationCreditPriceForBank,
      verificationCreditMinPurchaseQuantity,
      EMI_CARD_CHARGES: emiCardPriceForBank,
      EMI_CARD_PRICE: emiCardPriceForBank,
      VERIFICATION_CREDIT_PRICE: verificationCreditPriceForBank,
      MIN_EMI_CARD_LIMIT: emiCardMinPurchaseQuantity,
      MIN_VERIFICATION_CREDIT_LIMIT: verificationCreditMinPurchaseQuantity,
      updatedAt: priceSettingDoc?.updatedAt || new Date(),
    };
  }

  /**
   * Updates price settings in both Setting collection and PriceSetting model
   */
  async updatePriceSettings(payload, updaterId) {
    const rawEmiPrice =
      payload.emiCardPriceForBank ??
      payload.EMI_CARD_CHARGES ??
      payload.EMI_CARD_PRICE ??
      payload.emiCardPrice;

    const rawEmiMinQty =
      payload.emiCardMinPurchaseQuantity ??
      payload.MIN_EMI_CARD_LIMIT ??
      payload.minEmiCardLimit ??
      payload.minCardQuantity;

    const rawVerifPrice =
      payload.verificationCreditPriceForBank ??
      payload.VERIFICATION_CREDIT_PRICE ??
      payload.verificationCreditPrice;

    const rawVerifMinQty =
      payload.verificationCreditMinPurchaseQuantity ??
      payload.MIN_VERIFICATION_CREDIT_LIMIT ??
      payload.minVerificationCreditLimit ??
      payload.minVerificationCredit;

    const priceSettingUpdateObj = {};

    if (rawEmiPrice !== undefined && rawEmiPrice !== null && !isNaN(Number(rawEmiPrice))) {
      const numVal = Number(rawEmiPrice);
      await Promise.all([
        Setting.findOneAndUpdate(
          { key: 'EMI_CARD_CHARGES' },
          { key: 'EMI_CARD_CHARGES', value: numVal, description: 'Flat charge fee for new or renewed EMI cards.' },
          { upsert: true, new: true }
        ),
        Setting.findOneAndUpdate(
          { key: 'EMI_CARD_PRICE' },
          { key: 'EMI_CARD_PRICE', value: numVal, description: 'Flat charge fee for new or renewed EMI cards.' },
          { upsert: true, new: true }
        ),
      ]);
      priceSettingUpdateObj.emiCardPriceForBank = numVal;
    }

    if (rawEmiMinQty !== undefined && rawEmiMinQty !== null && !isNaN(Number(rawEmiMinQty))) {
      const numVal = Number(rawEmiMinQty);
      await Setting.findOneAndUpdate(
        { key: 'MIN_EMI_CARD_LIMIT' },
        { key: 'MIN_EMI_CARD_LIMIT', value: numVal, description: 'Minimum purchase limit for EMI cards during bank onboarding.' },
        { upsert: true, new: true }
      );
      priceSettingUpdateObj.emiCardMinPurchaseQuantity = numVal;
    }

    if (rawVerifPrice !== undefined && rawVerifPrice !== null && !isNaN(Number(rawVerifPrice))) {
      const numVal = Number(rawVerifPrice);
      await Setting.findOneAndUpdate(
        { key: 'VERIFICATION_CREDIT_PRICE' },
        { key: 'VERIFICATION_CREDIT_PRICE', value: numVal, description: 'Price per verification credit for bank onboarding.' },
        { upsert: true, new: true }
      );
      priceSettingUpdateObj.verificationCreditPriceForBank = numVal;
    }

    if (rawVerifMinQty !== undefined && rawVerifMinQty !== null && !isNaN(Number(rawVerifMinQty))) {
      const numVal = Number(rawVerifMinQty);
      await Setting.findOneAndUpdate(
        { key: 'MIN_VERIFICATION_CREDIT_LIMIT' },
        { key: 'MIN_VERIFICATION_CREDIT_LIMIT', value: numVal, description: 'Minimum purchase limit for verification credits during bank onboarding.' },
        { upsert: true, new: true }
      );
      priceSettingUpdateObj.verificationCreditMinPurchaseQuantity = numVal;
    }

    if (Object.keys(priceSettingUpdateObj).length > 0) {
      priceSettingUpdateObj.updatedBy = updaterId;
      await PriceSetting.findOneAndUpdate(
        {},
        { $set: priceSettingUpdateObj },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return this.getPriceSettings();
  }
}

export const priceSettingsService = new PriceSettingsService();
