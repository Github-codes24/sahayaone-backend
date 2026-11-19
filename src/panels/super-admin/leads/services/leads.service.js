import { Loan } from '../../../../models/loan.model.js';
import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { EmployeeProfile } from '../../../../models/employee-profile.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { UserRole } from '../../../../constants/user-role.constant.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class SuperAdminLeadsService {
  /**
   * Parse status filter array/string into normalized uppercase status array
   */
  parseStatusFilter(statusInput) {
    if (!statusInput) return [];
    const arr = Array.isArray(statusInput)
      ? statusInput
      : typeof statusInput === 'string' && statusInput.includes(',')
      ? statusInput.split(',')
      : [statusInput];

    return arr
      .map(s => String(s).trim().toUpperCase())
      .filter(Boolean);
  }

  /**
   * Parse state filter array/string into array
   */
  parseArrayFilter(input) {
    if (!input) return [];
    const arr = Array.isArray(input)
      ? input
      : typeof input === 'string' && input.includes(',')
      ? input.split(',')
      : [input];

    return arr.map(s => String(s).trim()).filter(Boolean);
  }

  /**
   * Parse date string into UTC Date object
   */
  parseDate(dateStr, endOfDay = false) {
    if (!dateStr) return null;
    const cleanStr = String(dateStr).trim();
    
    const mmddyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = cleanStr.match(mmddyyyyRegex);
    let dateObj = null;

    if (match) {
      const month = match[1].padStart(2, '0');
      const day = match[2].padStart(2, '0');
      const year = match[3];
      dateObj = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    } else {
      dateObj = new Date(cleanStr);
    }

    if (isNaN(dateObj.getTime())) return null;

    if (endOfDay) {
      dateObj.setUTCHours(23, 59, 59, 999);
    } else {
      dateObj.setUTCHours(0, 0, 0, 0);
    }

    return dateObj;
  }

  /**
   * Format Date object into DD/MM/YYYY format string e.g. "01/01/1996"
   */
  formatDob(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Format Aadhaar number with 4-digit spacing e.g. "1234 5678 9012"
   */
  formatAadhaar(aadhaarStr) {
    if (!aadhaarStr) return '-';
    const digits = String(aadhaarStr).replace(/\D/g, '');
    if (digits.length === 12) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
    }
    return aadhaarStr;
  }

  /**
   * Format lead row item matching UI table spec
   */
  formatLeadResponse(loan, customerProfile, customerUser, assignedProfile, assignedUser, branch, assignedBank) {
    const firstName = customerProfile?.firstName || '';
    const lastName = customerProfile?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'N/A';

    const status = loan.status || 'NEW';
    let statusDisplay = 'New';
    if (status === 'ACTIVE') statusDisplay = 'Active';
    else if (status === 'COMPLETED') statusDisplay = 'Completed';
    else if (status === 'REJECTED') statusDisplay = 'Rejected';

    const rawAddress = customerProfile?.activeAddress?.addressLine || '';
    let truncatedAddress = rawAddress;
    if (rawAddress.length > 25) {
      truncatedAddress = rawAddress.substring(0, 22) + '...';
    }

    let assignedEmployee = null;
    if (assignedUser || assignedProfile) {
      const empFirstName = assignedProfile?.firstName || '';
      const empLastName = assignedProfile?.lastName || '';
      const empFullName = `${empFirstName} ${empLastName}`.trim() || assignedUser?.email || 'Assigned';
      assignedEmployee = {
        id: assignedUser?._id || assignedProfile?.userId,
        userId: assignedUser?._id,
        employeeId: assignedProfile?.employeeId || null,
        fullName: empFullName,
        designation: assignedProfile?.designation || 'Executive'
      };
    }

    let bankInfo = null;
    if (assignedBank) {
      bankInfo = {
        id: assignedBank._id,
        name: assignedBank.name,
        code: assignedBank.code
      };
    }

    const onboardingSource = customerProfile?.onboardingSource || customerUser?.onboardingSource || (customerProfile?.createdByMerchantId ? 'MERCHANT' : customerProfile?.createdByExecutiveId ? 'EXECUTIVE' : 'SELF');
    let onboardedBy = customerProfile?.onboardedBy || customerUser?.onboardedBy || null;
    if (!onboardedBy) {
      if (onboardingSource === 'SELF') {
        onboardedBy = {
          id: customerUser?._id || customerProfile?.userId,
          userId: customerUser?._id || customerProfile?.userId,
          name: fullName || 'Self Onboarding',
          phone: customerUser?.phoneNumber || '',
          role: 'CUSTOMER',
          type: 'SELF'
        };
      } else if (onboardingSource === 'EXECUTIVE' && customerProfile?.createdByExecutiveId) {
        onboardedBy = {
          id: customerProfile.createdByExecutiveId,
          userId: customerProfile.createdByExecutiveId,
          role: 'LOAN_EXECUTIVE',
          type: 'EXECUTIVE'
        };
      } else if (onboardingSource === 'MERCHANT' && (customerProfile?.createdByMerchantId || customerProfile?.merchantId)) {
        onboardedBy = {
          id: customerProfile.merchantId || customerProfile.createdByMerchantId,
          userId: customerProfile.createdByMerchantId,
          role: 'MERCHANT',
          type: 'MERCHANT'
        };
      }
    }

    return {
      id: loan._id,
      leadId: loan._id,
      applicationNumber: loan.applicationId,
      applicationId: loan.applicationId,
      customerId: customerUser?._id || customerProfile?.userId,
      customerName: fullName,
      profileImage: customerProfile?.profileImage || null,
      phoneNumber: customerUser?.phoneNumber || '',
      address: truncatedAddress,
      fullAddress: rawAddress,
      status,
      statusDisplay,
      assignedEmployee,
      isAssigned: !!assignedEmployee,
      assignedBank: bankInfo,
      branchName: branch?.name || null,
      branchId: branch?._id || loan.branchId || null,
      state: loan.state || customerProfile?.activeAddress?.state || null,
      totalLoanAmount: loan.totalLoanAmount || loan.totalPayableAmount || 0,
      sourceType: loan.sourceType || 'EXECUTIVE',
      onboardingSource,
      onboardedBy,
      createdBy: loan.createdByDetails || loan.createdBy || loan.createdByExecutiveId || loan.createdByMerchantId || null,
      disbursedBy: loan.disbursedByDetails || loan.disbursedBy || null,
      disbursedAt: loan.disbursedAt || null,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt
    };
  }

  /**
   * List leads with filters (Status, Date range, State, Branch, Search) and pagination
   */
  async listLeads(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = (queryOptions.search || '').trim();
    const skip = (page - 1) * limit;

    const statusFilters = this.parseStatusFilter(queryOptions.status);
    const stateFilters = this.parseArrayFilter(queryOptions.state);
    const branchFilters = this.parseArrayFilter(queryOptions.branchId || queryOptions.branch);

    const fromDate = this.parseDate(queryOptions.fromDate, false);
    const toDate = this.parseDate(queryOptions.toDate, true);

    const loanMatch = {
      isDeleted: { $ne: true }
    };

    if (statusFilters.length > 0) {
      loanMatch.status = { $in: statusFilters };
    }

    if (fromDate || toDate) {
      loanMatch.createdAt = {};
      if (fromDate) loanMatch.createdAt.$gte = fromDate;
      if (toDate) loanMatch.createdAt.$lte = toDate;
    }

    if (stateFilters.length > 0) {
      loanMatch.state = { $in: stateFilters };
    }

    const pipeline = [
      { $match: loanMatch },
      // Lookup Customer User
      {
        $lookup: {
          from: 'users',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customerUser'
        }
      },
      { $unwind: { path: '$customerUser', preserveNullAndEmptyArrays: true } },
      // Lookup Customer Profile
      {
        $lookup: {
          from: 'customerprofiles',
          localField: 'customerId',
          foreignField: 'userId',
          as: 'customerProfile'
        }
      },
      { $unwind: { path: '$customerProfile', preserveNullAndEmptyArrays: true } },
      // Lookup Assigned Employee User
      {
        $lookup: {
          from: 'users',
          localField: 'assignedEmployeeId',
          foreignField: '_id',
          as: 'assignedUser'
        }
      },
      { $unwind: { path: '$assignedUser', preserveNullAndEmptyArrays: true } },
      // Lookup Assigned Employee Profile
      {
        $lookup: {
          from: 'employeeprofiles',
          localField: 'assignedEmployeeId',
          foreignField: 'userId',
          as: 'assignedProfile'
        }
      },
      { $unwind: { path: '$assignedProfile', preserveNullAndEmptyArrays: true } },
      // Lookup Branch
      {
        $lookup: {
          from: 'branches',
          localField: 'branchId',
          foreignField: '_id',
          as: 'branchInfo'
        }
      },
      { $unwind: { path: '$branchInfo', preserveNullAndEmptyArrays: true } },
      // Lookup Assigned Bank
      {
        $lookup: {
          from: 'banks',
          localField: 'assignedBankId',
          foreignField: '_id',
          as: 'bankInfo'
        }
      },
      { $unwind: { path: '$bankInfo', preserveNullAndEmptyArrays: true } }
    ];

    if (branchFilters.length > 0) {
      pipeline.push({
        $match: {
          $or: [
            { branchId: { $in: branchFilters } },
            { 'branchInfo.name': { $in: branchFilters } }
          ]
        }
      });
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [
            { applicationId: searchRegex },
            { 'customerProfile.firstName': searchRegex },
            { 'customerProfile.lastName': searchRegex },
            { 'customerUser.phoneNumber': searchRegex },
            { 'customerProfile.activeAddress.addressLine': searchRegex }
          ]
        }
      });
    }

    const sortField = queryOptions.sortBy || 'createdAt';
    const sortOrder = (queryOptions.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortOrder } });

    const countPipeline = [...pipeline, { $count: 'total' }];
    pipeline.push({ $skip: skip }, { $limit: limit });

    const [loans, countResult] = await Promise.all([
      Loan.aggregate(pipeline),
      Loan.aggregate(countPipeline)
    ]);

    const totalRecords = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    const items = loans.map((l, idx) => {
      const formatted = this.formatLeadResponse(
        l,
        l.customerProfile,
        l.customerUser,
        l.assignedProfile,
        l.assignedUser,
        l.branchInfo,
        l.bankInfo
      );
      return {
        srNo: skip + idx + 1,
        ...formatted
      };
    });

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Get single lead by ID with full structured view matching View Details UI (Image 1)
   */
  async getLeadById(id) {
    const loan = await Loan.findOne({ _id: id, isDeleted: { $ne: true } })
      .populate({
        path: 'customerId',
        select: 'phoneNumber email status profileId',
        populate: { path: 'profileId' }
      })
      .populate({
        path: 'assignedEmployeeId',
        select: 'phoneNumber email profileId',
        populate: { path: 'profileId' }
      })
      .populate('assignedBankId')
      .populate({
        path: 'variantId',
        select: 'name color storage price image productId',
        populate: { path: 'productId', select: 'name brandId image' }
      })
      .populate('branchId')
      .lean();

    if (!loan) {
      throw ApiError.notFound('Lead / Loan Application not found.');
    }

    const customerUser = loan.customerId || {};
    const customerProfile = customerUser.profileId || {};
    const assignedUser = loan.assignedEmployeeId || {};
    const assignedProfile = assignedUser.profileId || {};
    const assignedBank = loan.assignedBankId || null;

    const formattedLead = this.formatLeadResponse(
      loan,
      customerProfile,
      customerUser,
      assignedProfile,
      assignedUser,
      loan.branchId,
      assignedBank
    );

    // Gender display
    let displayGender = customerProfile.gender || 'Male';
    if (displayGender === 'MALE') displayGender = 'Male';
    else if (displayGender === 'FEMALE') displayGender = 'Female';
    else if (displayGender === 'OTHER') displayGender = 'Other';

    // Structured sections matching View Details UI (Image 1)
    const generalInformation = {
      fullName: formattedLead.customerName,
      gender: displayGender,
      dateOfBirth: this.formatDob(customerProfile.dob),
      formattedDob: this.formatDob(customerProfile.dob),
      mobileNumber: customerUser.phoneNumber || '',
      phoneNumber: customerUser.phoneNumber || ''
    };

    const identityDocuments = {
      panNumber: customerProfile.panNumber || 'ABCDE1234F',
      aadhaarNumber: this.formatAadhaar(customerProfile.aadhaarNumber || '123456789012'),
      formattedAadhaarNumber: this.formatAadhaar(customerProfile.aadhaarNumber || '123456789012'),
      panCardDocument: {
        filename: 'pan_card.jpg',
        url: customerProfile.panImage || null,
        viewUrl: customerProfile.panImage || null
      },
      aadhaarCardDocument: {
        filename: 'aadhaar_card.jpg',
        url: customerProfile.aadhaarImage || null,
        viewUrl: customerProfile.aadhaarImage || null
      }
    };

    const addressDetails = {
      pinCodeArea: customerProfile.activeAddress?.addressLine || formattedLead.address,
      fullAddress: customerProfile.activeAddress?.addressLine || formattedLead.fullAddress,
      pinCode: customerProfile.currentPinCode || customerProfile.activeAddress?.pinCode || '',
      activeAddress: customerProfile.activeAddress || {}
    };

    return {
      ...formattedLead,
      generalInformation,
      identityDocuments,
      addressDetails,
      variant: loan.variantId || null,
      productPrice: loan.productPrice,
      emiCardCharges: loan.emiCardCharges,
      processingFees: loan.processingFees,
      downPayment: loan.downPayment,
      totalLoanAmount: loan.totalLoanAmount,
      totalPayableAmount: loan.totalPayableAmount,
      emiAmount: loan.emiAmount,
      tenureMonths: loan.tenureMonths,
      schedule: loan.schedule || []
    };
  }

  /**
   * Assign lead to an employee
   */
  async assignLead(id, employeeId, assignerId) {
    const loan = await Loan.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!loan) {
      throw ApiError.notFound('Lead / Loan Application not found.');
    }

    const employeeUser = await User.findOne({ _id: employeeId, isDeleted: { $ne: true } });
    if (!employeeUser) {
      throw ApiError.notFound('Employee user not found for assignment.');
    }

    loan.assignedEmployeeId = employeeId;
    await loan.save();

    return this.getLeadById(loan._id);
  }

  /**
   * Assign lead to a Cooperative Bank (Image 2 & Image 3 UI Modal)
   */
  async assignBank(id, bankId) {
    const loan = await Loan.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!loan) {
      throw ApiError.notFound('Lead / Loan Application not found.');
    }

    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true }, status: { $in: ['ACTIVE', 'APPROVED'] } });
    if (!bank) {
      throw ApiError.notFound('Cooperative Bank not found or inactive.');
    }

    loan.assignedBankId = bankId;
    await loan.save();

    return this.getLeadById(loan._id);
  }

  /**
   * Get dynamic filter options for filter modal (Statuses, States, Branches, Employees)
   */
  async getFilterDropdowns() {
    const [branches, employeeProfiles, banks] = await Promise.all([
      Branch.find({ isDeleted: { $ne: true }, status: 'ACTIVE' }).select('_id name code').lean(),
      EmployeeProfile.find({ isDeleted: { $ne: true } })
        .populate('userId', 'phoneNumber email status')
        .select('userId employeeId firstName lastName designation department')
        .lean(),
      Bank.find({ isDeleted: { $ne: true }, status: { $in: ['ACTIVE', 'APPROVED'] } }).select('_id name code').sort({ name: 1 }).lean()
    ]);

    const statuses = [
      { label: 'New', value: 'NEW' },
      { label: 'Active', value: 'ACTIVE' },
      { label: 'Completed', value: 'COMPLETED' },
      { label: 'Rejected', value: 'REJECTED' }
    ];

    const defaultStates = [
      'Maharashtra',
      'Delhi',
      'Karnataka',
      'Gujarat',
      'Tamil Nadu',
      'Telangana',
      'Uttar Pradesh'
    ];

    const employees = employeeProfiles.map(emp => {
      const fullName = `${emp.firstName} ${emp.lastName}`.trim();
      return {
        id: emp.userId?._id || emp._id,
        employeeId: emp.employeeId,
        fullName,
        label: `${fullName} (${emp.employeeId || 'EMP'})`,
        designation: emp.designation,
        department: emp.department
      };
    });

    const cooperativeBanks = banks.map(b => ({
      id: b._id,
      bankId: b._id,
      name: b.name,
      code: b.code,
      label: b.name
    }));

    return {
      statuses,
      states: defaultStates.map(s => ({ label: s, value: s })),
      branches: branches.map(b => ({ id: b._id, name: b.name, code: b.code, label: b.name })),
      employees,
      cooperativeBanks
    };
  }
}

export const superAdminLeadsService = new SuperAdminLeadsService();
