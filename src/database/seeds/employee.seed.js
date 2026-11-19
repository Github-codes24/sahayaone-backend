import { User } from '../../models/user.model.js';
import { EmployeeProfile } from '../../models/employee-profile.model.js';
import { Branch } from '../../models/branch.model.js';
import { cryptoUtil } from '../../utils/crypto.util.js';
import { UserRole, UserType } from '../../constants/user-role.constant.js';
import { logger } from '../../utils/logger.util.js';

export async function seedEmployee() {
  const email = 'employee@sahayaone.com';
  const password = 'Password@123';
  const employeeId = 'ABC12345';

  try {
    // 1. Clear existing employee data to ensure clean seed matching mockup
    await User.deleteMany({ role: UserRole.EMPLOYEE });
    await EmployeeProfile.deleteMany({});

    const passwordHash = await cryptoUtil.hash(password);

    // 2. Find seeded Branch to link
    const branch = await Branch.findOne({ code: 'PCB-BR01' });
    if (!branch) {
      logger.warn('SEEDER WARNING: Could not find branch PCB-BR01. Seeding employee without branch.');
    }

    // 3. Create Core Identity
    const employeeUser = new User({
      email,
      phoneNumber: '7777777777',
      passwordHash,
      role: UserRole.EMPLOYEE,
      userType: UserType.EMPLOYEE,
      status: 'ACTIVE',
      permissions: ['leads:view_only', 'customers:view_only']
    });

    await employeeUser.save();

    // 4. Create Corporate Employee Profile (matching mockup details)
    const profile = new EmployeeProfile({
      userId: employeeUser._id,
      employeeId,
      firstName: 'Ananya',
      lastName: 'Sharma',
      gender: 'FEMALE',
      dob: new Date('1993-07-28'),
      profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500',
      dutyHours: '10:00 to 19:00',
      weeklyOff: 'Saturday & Sunday',
      bloodGroup: 'B+',
      validity: new Date('2028-08-05'),
      officeAddress: '2nd floor, Abc building, Nagpur, Maharashtra',
      state: 'Maharashtra',
      designation: 'Loan Executive',
      department: 'Loans & Disbursals',
      branchId: branch ? branch._id : null,
      joiningDate: new Date('2023-08-05')
    });

    await profile.save();

    // 5. Link Profile ID back to User
    employeeUser.profileId = profile._id;
    employeeUser.profileModel = 'EmployeeProfile';
    await employeeUser.save();

    logger.info(`SEEDER SUCCESS: Employee seeded successfully [Email: ${email}, Password: ${password}, ID: ${employeeId}]`);
  } catch (error) {
    logger.error(`SEEDER EXCEPTION: Seeding employee failed: ${error.message}`);
    throw error;
  }
}
