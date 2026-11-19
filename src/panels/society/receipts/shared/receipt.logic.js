export const RECEIPT_PREFIX_BY_TYPE = Object.freeze({
  CREDIT: 'CR',
  DEBIT: 'DR',
  TRANSFER: 'TR',
  CONTRA: 'CT'
});

export const RECEIPT_EDITABLE_FIELDS = Object.freeze([
  'name',
  'glHead',
  'glHeadName',
  'accountNumber',
  'amount',
  'date'
]);

export const escapeSearchText = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  const num = Number(amount);
  if (num < 0) return '-₹' + Math.abs(num).toLocaleString('en-IN');
  return '₹' + num.toLocaleString('en-IN');
};


export const nextReceiptNumber = (type, latestReceiptNo = null) => {

  const prefix = RECEIPT_PREFIX_BY_TYPE[type];
  if (!prefix) throw new Error(`Unsupported receipt type: ${type}`);
  const current = latestReceiptNo ? Number(String(latestReceiptNo).split('-')[1]) : 0;
  return `${prefix}-${String(current + 1).padStart(6, '0')}`;
};

export const formatReceipt = (receipt, srNo = null) => {
  const branchObj = receipt.branchId && typeof receipt.branchId === 'object' ? receipt.branchId : null;
  const branchId = branchObj ? branchObj._id.toString() : (receipt.branchId ? receipt.branchId.toString() : null);
  const branchName = branchObj?.name || branchObj?.branchName || null;
  const city = branchObj?.address?.city || branchObj?.city || null;
  const state = branchObj?.address?.state || branchObj?.state || null;


  const rawAmount = receipt.amount !== undefined && receipt.amount !== null ? Number(receipt.amount) : 0;

  const result = {
    id: receipt._id,
    receiptNo: receipt.receiptNo,
    name: receipt.name,
    glHead: receipt.glHead,
    glHeadName: receipt.glHeadName,
    accountNumber: receipt.accountNumber,
    amount: rawAmount,
    formattedAmount: '₹' + rawAmount.toLocaleString('en-IN'),
    date: receipt.date,
    status: receipt.status,
    rejectionReason: receipt.rejectionReason || null,
    branchId: branchId || null,
    branchName: branchName || null,
    city: city || null,
    state: state || null,
    image: receipt.image || null,
    imageKey: receipt.imageKey || null
  };
  return srNo === null ? result : { srNo, ...result };
};



export const receiptsToCsv = (records) => {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [
    ['Sr.No.', 'Receipt No', 'Name', 'GL Head', 'GL Head Name', 'A/C No.', 'Amount', 'Date', 'Status', 'Branch', 'Image URL'],
    ...records.map((record, index) => [
      index + 1,
      record.receiptNo,
      record.name,
      record.glHead,
      record.glHeadName,
      record.accountNumber,
      record.amount || 0,
      new Date(record.date).toISOString().slice(0, 10),
      record.status,
      record.branchId?.name || '',
      record.image || ''
    ])
  ];
  return rows.map((row) => row.map(escape).join(',')).join('\n');
};

