import mongoose from 'mongoose';

const { Schema } = mongoose;

const inventoryTransactionSchema = new Schema({
    itemMasterId: {
        type: Schema.Types.ObjectId,
        ref: 'InventoryItems',
    },
    assetId: {
        type: Schema.Types.ObjectId,
        ref: 'Asset',
    },
    locationType: {
        type: String,
        enum: ['CentralInventory', 'Branch', 'User'],
    },
    locationId: {
        type: Schema.Types.ObjectId,
        refPath: 'locationType',
    },
    type: {
        type: String,
        enum: ['STOCK_IN', 'ISSUE', 'RETURN', 'TRANSFER', 'ADJUSTMENT'],
        required: true,
    },
    quantity: {
        type: Number,
    },
    referenceType: {
        type: String,
        enum: ['Request', 'Transfer', 'StockAdjustment', 'Vendor', 'AssetsAssignment'],
    },
    referenceId: {
        type: Schema.Types.ObjectId,
        refPath: 'referenceType',
    },
    performedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    remarks: {
        type: String,
        trim: true,
        default: '',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const InventoryTransaction = mongoose.models.InventoryTransaction || mongoose.model('InventoryTransaction', inventoryTransactionSchema);
export default InventoryTransaction;