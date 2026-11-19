import { User } from '../../models/user.model.js';
import { cryptoUtil } from '../../utils/crypto.util.js';
import { UserRole, UserType } from '../../constants/user-role.constant.js';
import { logger } from '../../utils/logger.util.js';

export async function seedOnboardingTeam() {
  const email = 'onboarding@sahayaone.com';
  const phoneNumber = '6666666666';
  const password = 'Password@123';

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      let updated = false;
      if (!existingUser.phoneNumber) {
        existingUser.phoneNumber = phoneNumber;
        updated = true;
      }
      if (existingUser.role !== UserRole.ONBOARDING_TEAM) {
        existingUser.role = UserRole.ONBOARDING_TEAM;
        updated = true;
      }
      if (existingUser.userType !== UserType.ONBOARDING_TEAM) {
        existingUser.userType = UserType.ONBOARDING_TEAM;
        updated = true;
      }
      if (updated) {
        await existingUser.save();
        logger.info(`SEEDER: Updated existing Onboarding Team user: ${email} with missing properties.`);
      } else {
        logger.info(`SEEDER: Onboarding Team user already seeded with email: ${email}`);
      }
      return;
    }

    const passwordHash = await cryptoUtil.hash(password);

    const onboardingUser = new User({
      email,
      phoneNumber,
      passwordHash,
      role: UserRole.ONBOARDING_TEAM,
      userType: UserType.ONBOARDING_TEAM,
      status: 'ACTIVE',
      permissions: ['banks:read_write', 'partners:read_write']
    });

    await onboardingUser.save();

    logger.info(`SEEDER SUCCESS: Onboarding Team user seeded successfully [Email: ${email}, Phone: ${phoneNumber}]`);
  } catch (error) {
    logger.error(`SEEDER ERROR: Failed to seed Onboarding Team: ${error.message}`);
  }
}
