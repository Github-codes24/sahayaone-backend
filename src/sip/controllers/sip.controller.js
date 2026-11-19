import {
  getCustomerSIPs,
  getSIPById,
} from "../services/sip.service.js";

// ==========================================
// GET CUSTOMER SIPS
// ==========================================
export const getCustomerSIPsController = async (req, res) => {
  try {
    const customerId = req.user._id;

    const sips = await getCustomerSIPs(customerId);

    return res.status(200).json({
      success: true,
      message: "Customer SIP subscriptions fetched successfully",
      data: sips,
    });
  } catch (error) {
    console.error("Get Customer SIPs Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch SIP subscriptions",
    });
  }
};

// ==========================================
// GET SINGLE SIP BY ID FOR CUSTOMER
// ==========================================
export const getSIPByIdController = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { id } = req.params;

    const sip = await getSIPById(id, customerId);

    return res.status(200).json({
      success: true,
      message: "SIP subscription fetched successfully",
      data: sip,
    });
  } catch (error) {
    console.error("Get SIP By ID Error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch SIP subscription",
    });
  }
};
