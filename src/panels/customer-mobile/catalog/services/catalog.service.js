import { Banner } from '../../../../models/banner.model.js';
import { Brand } from '../../../../models/brand.model.js';
import { Product } from '../../../../models/product.model.js';
import { Variant } from '../../../../models/variant.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class CustomerCatalogService {
  /**
   * Retrieves active banners for Customer Mobile App
   */
  async getBanners(queryOptions = {}) {
    const { bannerType, portalType } = queryOptions;

    const targetPortal = portalType && typeof portalType === 'string' && portalType.trim()
      ? portalType.trim().toUpperCase()
      : 'CUSTOMER_APP';

    const filter = {
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      portalType: {
        $in: [
          targetPortal,
          ...(targetPortal === 'CUSTOMER_APP' ? ['Customer App', 'CUSTOMER'] : [])
        ]
      }
    };

    if (bannerType && typeof bannerType === 'string' && bannerType.trim()) {
      filter.bannerType = new RegExp(`^${bannerType.trim()}$`, 'i');
    }

    const banners = await Banner.find(filter)
      .sort({ createdAt: -1 })
      .select('_id portalType bannerType imageUrl imageKey status createdAt')
      .lean();

    return {
      banners,
      count: banners.length
    };
  }
  /**
   * Returns list of explore services (matches screenshot)
   */
  async getServices() {
    return [
      { name: 'Loans', icon: '/public/services/loans.png', slug: 'loans' },
      { name: 'EMI Card', icon: '/public/services/emi_card.png', slug: 'emi-card' },
      { name: 'Company Name Pay', icon: '/public/services/pay.png', slug: 'pay' },
      { name: 'Bills & Recharge', icon: '/public/services/bills.png', slug: 'bills-recharge' },
      { name: 'Insurance', icon: '/public/services/insurance.png', slug: 'insurance' },
      { name: 'Deals & Savings', icon: '/public/services/deals.png', slug: 'deals-savings' },
      { name: 'Investments', icon: '/public/services/investments.png', slug: 'investments' },
      { name: 'Share Market', icon: '/public/services/share_market.png', slug: 'share-market' },
      { name: 'Shopping', icon: '/public/services/shopping.png', slug: 'shopping' },
      { name: 'Travels', icon: '/public/services/travels.png', slug: 'travels' },
      { name: 'Credit Score', icon: '/public/services/credit_score.png', slug: 'credit-score' },
      { name: 'Calculators', icon: '/public/services/calculators.png', slug: 'calculators' }
    ];
  }

  /**
   * Returns loan categories with flow types & custom schemas (matches screenshot)
   */
  async getLoanCategories() {
    return [
      {
        name: 'Mobiles on EMI',
        slug: 'mobiles-on-emi',
        icon: '/public/loan-categories/mobiles.png',
        flowType: 'PRODUCT_CATALOG',
        formSchema: []
      },
      {
        name: 'Electronics on EMI',
        slug: 'electronics-on-emi',
        icon: '/public/loan-categories/electronics.png',
        flowType: 'PRODUCT_CATALOG',
        formSchema: []
      },
      {
        name: 'Two Wheeler Loan',
        slug: 'two-wheeler-loan',
        icon: '/public/loan-categories/two_wheeler.png',
        flowType: 'DIRECT_KYC',
        formSchema: [
          { name: 'employmentType', label: 'Employment Type', type: 'SELECT', required: true, options: ['Salaried', 'Self-Employed'] },
          { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 25000' }
        ]
      },
      {
        name: 'Used Car Loan',
        slug: 'used-car-loan',
        icon: '/public/loan-categories/used_car.png',
        flowType: 'DIRECT_KYC',
        formSchema: [
          { name: 'employmentType', label: 'Employment Type', type: 'SELECT', required: true, options: ['Salaried', 'Self-Employed'] },
          { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 40000' }
        ]
      },
      {
        name: 'New Car Loan',
        slug: 'new-car-loan',
        icon: '/public/loan-categories/new_car.png',
        flowType: 'DIRECT_KYC',
        formSchema: [
          { name: 'employmentType', label: 'Employment Type', type: 'SELECT', required: true, options: ['Salaried', 'Self-Employed'] },
          { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 50000' }
        ]
      },
      {
        name: 'Tractor Finance',
        slug: 'tractor-finance',
        icon: '/public/loan-categories/tractor.png',
        flowType: 'DIRECT_KYC',
        formSchema: [
          { name: 'landOwnership', label: 'Agricultural Land Owned (Acres)', type: 'NUMBER', required: true, placeholder: 'e.g., 5' }
        ]
      },
      {
        name: 'Personal Loan',
        slug: 'personal-loan',
        icon: '/public/loan-categories/personal.png',
        flowType: 'DIRECT_KYC',
        formSchema: [
          { name: 'employmentType', label: 'Employment Type', type: 'SELECT', required: true, options: ['Salaried', 'Self-Employed'] },
          { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 30000' },
          { name: 'companyName', label: 'Company Name', type: 'TEXT', required: true, placeholder: 'e.g., Sahayaone Corp' }
        ]
      },
      {
        name: 'Home Loan',
        slug: 'home-loan',
        icon: '/public/loan-categories/home.png',
        flowType: 'DIRECT_KYC',
        formSchema: [
          { name: 'monthlyIncome', label: 'Monthly Income', type: 'NUMBER', required: true, placeholder: 'e.g., 60000' },
          { name: 'propertyValue', label: 'Property Agreement Value', type: 'NUMBER', required: true, placeholder: 'e.g., 3500000' }
        ]
      },
      {
        name: 'Gold Loan',
        slug: 'gold-loan',
        icon: '/public/loan-categories/gold.png',
        flowType: 'DIRECT_KYC',
        formSchema: [
          { name: 'goldWeightGrams', label: 'Gold Weight (in Grams)', type: 'NUMBER', required: true, placeholder: 'e.g., 25' }
        ]
      }
    ];
  }

  /**
   * Retrieves all active brands
   */
  async getBrands() {
    return await Brand.find({ isDeleted: false });
  }

  /**
   * Retrieves products for a specific brand ID
   */
  async getProducts(brandId) {
    if (!brandId) {
      throw ApiError.badRequest('Brand parameter brandId is required.', ErrorCode.VALIDATION_ERROR);
    }
    return await Product.find({ brandId, isDeleted: false });
  }

  /**
   * Retrieves variant configurations for a product ID
   */
  async getProductVariants(productId) {
    if (!productId) {
      throw ApiError.badRequest('Product parameter productId is required.', ErrorCode.VALIDATION_ERROR);
    }
    return await Variant.find({ productId, isDeleted: false });
  }

  /**
   * Performs unified search across brands, products, and services (Paytm-style)
   * @param {String} query - The search query term
   */
  async searchCatalog(query) {
    const trimmedQuery = query?.trim();

    // If query is empty, return popular recommended services/brands
    if (!trimmedQuery) {
      const popularBrands = await Brand.find({ isDeleted: false }).limit(4).lean();
      const allLoanCategories = await this.getLoanCategories();
      const popularServices = [
        allLoanCategories.find(c => c.name === 'Mobiles on EMI'),
        allLoanCategories.find(c => c.name === 'Personal Loan'),
        allLoanCategories.find(c => c.name === 'Used Car Loan')
      ].filter(Boolean);

      return {
        isRecommended: true,
        brands: popularBrands,
        products: [],
        services: popularServices
      };
    }

    const regex = new RegExp(trimmedQuery, 'i');

    // 1. Search Brands
    const brands = await Brand.find({
      name: { $regex: regex },
      isDeleted: false
    }).lean();

    // 2. Search Products
    const products = await Product.find({
      name: { $regex: regex },
      isDeleted: false
    }).populate('brandId').lean();

    // 3. Search Services
    const allLoanCategories = await this.getLoanCategories();
    const services = allLoanCategories.filter(category => 
      category.name.match(regex) || category.slug.match(regex)
    );

    return {
      isRecommended: false,
      brands,
      products,
      services
    };
  }
}

export const customerCatalogService = new CustomerCatalogService();
