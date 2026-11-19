import { User } from '../../../../models/user.model.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { logger } from '../../../../utils/logger.util.js';
import { societyEmployeeService } from '../../../society/employees/services/society-employee.service.js';
import { reverseGeocodeCoordinates } from '../../../../utils/geocoding.util.js';

export class EmployeeProfileService {
  /**
   * Fetches the full profile details for the logged-in employee,
   * returning the exact same detailed response structure as GET /api/v1/society/employees/:id
   */
  async getProfile(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.notFound('Employee account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (!user.profileId) {
      throw ApiError.notFound('Employee profile details not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Retrieve full detailed profile formatted identically to GET /api/v1/society/employees/:id
    const employeeData = await societyEmployeeService.getEmployeeById(user.bankId, user.profileId);

    const fullName = employeeData.fullName || `${employeeData.firstName || ''} ${employeeData.lastName || ''}`.trim() || user.fullName || '';
    const firstName = employeeData.firstName || fullName.split(' ')[0] || '';
    const lastName = employeeData.lastName || fullName.split(' ').slice(1).join(' ') || '';

    return {
      ...employeeData,
      fullName,
      firstName,
      lastName,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        userType: user.userType,
        status: user.status
      },
      profile: {
        employeeId: employeeData.employeeCode || employeeData.employeeId || String(employeeData.id),
        firstName,
        lastName,
        fullName,
        gender: employeeData.personalDetails?.gender || 'MALE',
        dob: employeeData.personalDetails?.dob || employeeData.personalDetails?.dateOfBirth || null,
        profileImage: employeeData.personalDetails?.profileImage || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
        dutyHours: employeeData.dutyHours || '10:00 to 19:00',
        weeklyOff: employeeData.weeklyOff || 'Sunday',
        bloodGroup: employeeData.bloodGroup || '',
        validity: employeeData.validity || null,
        officeAddress: employeeData.officeAddress || '',
        state: employeeData.state || '',
        designation: employeeData.designation || 'EMPLOYEE',
        department: employeeData.department || 'Loans & Disbursals',
        branchName: employeeData.branch?.name || 'Main Branch'
      }
    };
  }

  /**
   * Validates old password and updates user credentials to the new hashed password
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Employee account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (!user.passwordHash) {
      throw ApiError.badRequest('Password authentication is not configured for this account.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isMatch = await cryptoUtil.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw ApiError.badRequest('Your old password is incorrect.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    user.passwordHash = await cryptoUtil.hash(newPassword);
    await user.save();

    logger.info(`EMPLOYEE PROFILE: Password successfully updated for user: ${user.email || user.phoneNumber}`);

    return {
      success: true,
      message: 'Your password has been changed successfully.'
    };
  }

  /**
   * Updates coordinates position and resolved street address text for the logged-in employee
   */
  async updateLocation(userId, latitude, longitude, address = '') {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Employee account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    let finalAddress = address ? address.trim() : '';

    // If address is not sent by frontend, automatically resolve address via Google Maps Geocoding API
    if (!finalAddress) {
      finalAddress = await reverseGeocodeCoordinates(latitude, longitude);
    }

    if (!finalAddress) {
      finalAddress = user.location?.address || '';
    }

    user.location = {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)], // GeoJSON format requires [longitude, latitude]
      address: finalAddress,
      lastUpdatedAt: new Date()
    };

    await user.save();
    logger.info(`EMPLOYEE PROFILE: Location updated for user: ${user.email || user.phoneNumber} (Lat: ${latitude}, Long: ${longitude})`);

    return {
      success: true,
      message: 'Location coordinate position updated successfully.',
      location: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: finalAddress,
        lastUpdatedAt: user.location.lastUpdatedAt
      }
    };
  }
}

export const employeeProfileService = new EmployeeProfileService();
