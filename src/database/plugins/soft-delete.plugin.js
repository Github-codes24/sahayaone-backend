import mongoose from 'mongoose';

export default function softDeletePlugin(schema) {
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  });

  const excludeDeleted = function(next) {
    const filter = this.getFilter() || {};

    if (filter.includeDeleted === true) {
      delete filter.includeDeleted;
      this.setQuery(filter);
      return next();
    }

    if (filter.isDeleted !== undefined) {
      return next();
    }
    
    this.where({ isDeleted: false });
    next();
  };

  const queryHooks = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'update',
    'updateOne',
    'updateMany',
    'countDocuments',
    'estimatedDocumentCount'
  ];

  queryHooks.forEach((hook) => {
    schema.pre(hook, excludeDeleted);
  });

  schema.pre('aggregate', function(next) {
    const pipeline = this.pipeline();
    const hasDeletedMatch = pipeline.some(step => step.$match && step.$match.isDeleted !== undefined);
    if (!hasDeletedMatch) {
      pipeline.unshift({ $match: { isDeleted: false } });
    }
    next();
  });
}
