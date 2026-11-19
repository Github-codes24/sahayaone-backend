export const calculateNextDueDate = (date, frequency) => {
  const nextDate = new Date(date);
  

  switch (frequency) {
    case "DAILY":
      nextDate.setDate(nextDate.getDate() + 1);
      break;

    case "WEEKLY":
      nextDate.setDate(nextDate.getDate() + 7);
      break;

    case "MONTHLY":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;

    default:
      throw new Error("Invalid SIP frequency");
  }

  return nextDate;
};