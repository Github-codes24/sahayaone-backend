import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['NEW_LEAD', 'LOAN_OVERDUE', 'LOAN_DUE_DATE', 'GENERAL', 'ALERT'],
      default: 'GENERAL',
      index: true
    },
    targetRole: {
      type: String,
      enum: ['SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE', 'CUSTOMER', 'VENDOR', 'ALL'],
      default: 'SUPER_ADMIN',
      index: true
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    actionText: {
      type: String,
      default: 'Check Now'
    },
    actionUrl: {
      type: String,
      default: '/admin/leads'
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    },
    icon: {
      type: String,
      default: 'user-plus'
    },
    iconColor: {
      type: String,
      default: '#28C76F'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

notificationSchema.plugin(softDeletePlugin);

export const Notification = mongoose.model('Notification', notificationSchema);
