import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { societyDashboardController } from '../controllers/society-dashboard.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  getDashboardStatsSchema,
  getRevenueChartSchema,
  getLoanDistributedChartSchema,
  getServicesStatsSchema
} from '../validators/society-dashboard.validator.js';

const router = Router();

// Middleware pipeline: Authentication and Society context resolution
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

/**
 * @route   GET /api/v1/society/dashboard/stats
 * @desc    API 1: Get Society Dashboard KPI Stats Cards
 * @access  Private (Society Admin, Branch Manager, Society Employee)
 */
router.get(
  '/stats',
  validateRequest(getDashboardStatsSchema),
  societyDashboardController.getStats
);

/**
 * @route   GET /api/v1/society/dashboard/revenue-chart
 * @desc    API 2: Get Total Revenue Monthly Comparison Chart (Graph 1)
 * @access  Private
 */
router.get(
  '/revenue-chart',
  validateRequest(getRevenueChartSchema),
  societyDashboardController.getRevenueChart
);

/**
 * @route   GET /api/v1/society/dashboard/loan-distributed-chart
 * @desc    API 3: Get Loan Distributed by Category Chart (Graph 2)
 * @access  Private
 */
router.get(
  '/loan-distributed-chart',
  validateRequest(getLoanDistributedChartSchema),
  societyDashboardController.getLoanDistributedChart
);

/**
 * @route   GET /api/v1/society/dashboard/services-stats
 * @desc    API 4: Get All Services Sales Contribution Stats (Loan service active)
 * @access  Private
 */
router.get(
  '/services-stats',
  validateRequest(getServicesStatsSchema),
  societyDashboardController.getServicesStats
);

/**
 * @route   GET /api/v1/society/dashboard/overview
 * @desc    Get Consolidated Society Dashboard Overview Data
 * @access  Private
 */
router.get(
  '/overview',
  validateRequest(getDashboardStatsSchema),
  societyDashboardController.getOverview
);

export default router;
