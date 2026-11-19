import React, { useState, useEffect, useRef } from "react";

/**
 * Utility to dynamically load the Razorpay Checkout SDK script
 */
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * CardsCreditPurchaseModal React Component
 *
 * Payment Architecture (Identical to Bank Onboarding panel):
 * 1. POST /api/v1/society/cards-credit/payment/initiate (or /purchase) → Initiates payment order
 * 2. Razorpay Checkout Popup opens
 * 3. On payment complete callback: POST /api/v1/society/cards-credit/payment/verify → Signature verification & instant credit allocation
 * 4. Webhook fallback: POST /api/v1/society/cards-credit/webhooks/payment → Server-to-server confirmation
 */
export const CardsCreditPurchaseModal = ({
  apiBaseUrl = "http://localhost:5000",
  authToken,
  razorpayKeyId,
  razorpayKey,
  isOpen = true,
  onClose,
  onSuccess,
}) => {
  const [purchaseType, setPurchaseType] = useState("BOTH");
  const [emiQuantity, setEmiQuantity] = useState(100);
  const [verificationQuantity, setVerificationQuantity] = useState(200);
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [statusLog, setStatusLog] = useState("");
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [paymentLink, setPaymentLink] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollIntervalRef = useRef(null);
  const pollCountRef = useRef(0);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const getHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    if (authToken) {
      headers["Authorization"] = authToken.startsWith("Bearer ")
        ? authToken
        : `Bearer ${authToken}`;
    }
    return headers;
  };

  // 1. Calculate Price Estimation
  const handleCalculatePrice = async () => {
    setLoading(true);
    setStatusLog("Calculating total pricing...");
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/society/cards-credit/price/calculate`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            purchaseType,
            emiQuantity,
            verificationQuantity,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setPricing(data.data);
        setStatusLog("Price calculated successfully.");
      } else {
        setStatusLog(`Error: ${data.message}`);
      }
    } catch (err) {
      setStatusLog(`Price calculation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. Initiate Purchase → Open Razorpay Checkout Popup
  const handleInitiatePayment = async () => {
    setLoading(true);
    setPaymentLink(null);
    setStatusLog("Loading Razorpay SDK...");

    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      setStatusLog(
        "Failed to load Razorpay SDK. Please check your internet connection.",
      );
      setLoading(false);
      return;
    }

    setStatusLog("Creating payment order on backend...");
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/society/cards-credit/payment/initiate`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            purchaseType,
            emiQuantity,
            verificationQuantity,
          }),
        },
      );

      const result = await res.json();

      if (!res.ok || !result.success) {
        setStatusLog(`Purchase Failed: ${result.message}`);
        setLoading(false);
        return;
      }

      const orderData = result.data;
      setActiveOrderId(orderData.orderId);

      // Save payment link as fallback
      if (orderData.paymentLink) {
        setPaymentLink(orderData.paymentLink);
      }

      setStatusLog("Opening Razorpay Payment Popup...");

      // Razorpay Checkout Options
      const options = {
        key:
          razorpayKeyId ||
          razorpayKey ||
          orderData.keyId ||
          orderData.razorpayKeyId,
        amount: orderData.amountInPaise,
        currency: orderData.currency || "INR",
        name: "Sahayaone Enterprise ERP",
        description: `Credit Purchase (${purchaseType})`,
        order_id: orderData.orderId,
        handler: async function (paymentResponse) {
          setStatusLog("Payment completed in popup! Verifying with backend...");

          try {
            // Verify payment signature directly with backend
            const verifyRes = await fetch(
              `${apiBaseUrl}/api/v1/society/cards-credit/payment/verify`,
              {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                  razorpay_order_id:
                    paymentResponse.razorpay_order_id || orderData.orderId,
                  razorpay_payment_id: paymentResponse.razorpay_payment_id,
                  razorpay_signature: paymentResponse.razorpay_signature,
                }),
              },
            );
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              setStatusLog(
                `🎉 Payment Successful! Order ID: ${orderData.orderId}, Invoice: ${verifyData.data?.invoiceNumber || ""}`,
              );
              setLoading(false);
              if (onSuccess) onSuccess(verifyData.data);
              return;
            }
          } catch (err) {
            console.warn(
              "Direct verification failed, falling back to polling...",
              err,
            );
          }

          // Fallback to webhook polling if direct signature check fails
          startPolling(orderData.orderId);
        },
        prefill: orderData.prefill || {
          email: "bank@sahayaone.com",
          contact: "7798598099",
        },
        modal: {
          ondismiss: function () {
            setStatusLog(
              "Payment popup closed. You can use the payment link below to retry.",
            );
            setLoading(false);
          },
          escape: true,
          confirm_close: true,
        },
        theme: {
          color: "#6366f1",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        setStatusLog(`Payment Failed: ${response.error.description}`);
        setLoading(false);
      });

      rzp.open();
    } catch (err) {
      setStatusLog(`Request Error: ${err.message}`);
      setLoading(false);
    }
  };

  // 3. Poll backend for payment status (waits for Razorpay webhook to confirm)
  const startPolling = (orderId) => {
    setPolling(true);
    pollCountRef.current = 0;

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    setStatusLog("⏳ Waiting for payment confirmation... (polling every 5s)");

    pollIntervalRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > 60) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setPolling(false);
        setLoading(false);
        setStatusLog(
          "⏳ Payment verification timed out. If you completed payment, it will be updated shortly via webhook.",
        );
        return;
      }

      try {
        const res = await fetch(
          `${apiBaseUrl}/api/v1/society/cards-credit/payment-status/${orderId}`,
          {
            method: "GET",
            headers: getHeaders(),
          },
        );
        const result = await res.json();

        if (result.success && result.data.paymentStatus === "SUCCESS") {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setPolling(false);
          setLoading(false);
          setPaymentLink(null);
          setStatusLog(
            `🎉 Payment Successful! Order ID: ${orderId}, Invoice: ${result.data.invoiceNumber}`,
          );
          if (onSuccess) onSuccess(result.data);
        } else if (result.success && result.data.paymentStatus === "FAILED") {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setPolling(false);
          setLoading(false);
          setStatusLog(`❌ Payment Failed for Order: ${orderId}`);
        } else {
          setStatusLog(
            `⏳ Waiting for webhook confirmation... (attempt ${pollCountRef.current}/60)`,
          );
        }
      } catch (err) {
        setStatusLog(`Status check error: ${err.message} (retrying...)`);
      }
    }, 5000);
  };

  // Stop polling manually
  const handleStopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPolling(false);
    setLoading(false);
    setStatusLog(
      "Polling stopped. Payment will still be processed if completed.",
    );
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>💳 Buy Cards & Credits</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={styles.body}>
          {/* Purchase Type Selector */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Purchase Type</label>
            <select
              style={styles.select}
              value={purchaseType}
              onChange={(e) => setPurchaseType(e.target.value)}
              disabled={polling}
            >
              <option value="BOTH">
                BOTH (EMI Cards + Verification Credits)
              </option>
              <option value="EMI_CARD">EMI Cards Only</option>
              <option value="VERIFICATION_CREDIT">
                Verification Credits Only
              </option>
            </select>
          </div>

          {/* Quantities */}
          <div style={styles.row}>
            {(purchaseType === "BOTH" || purchaseType === "EMI_CARD") && (
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>EMI Card Quantity</label>
                <input
                  type="number"
                  style={styles.input}
                  value={emiQuantity}
                  onChange={(e) => setEmiQuantity(Number(e.target.value))}
                  min={1}
                  disabled={polling}
                />
              </div>
            )}

            {(purchaseType === "BOTH" ||
              purchaseType === "VERIFICATION_CREDIT") && (
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Verification Quantity</label>
                <input
                  type="number"
                  style={styles.input}
                  value={verificationQuantity}
                  onChange={(e) =>
                    setVerificationQuantity(Number(e.target.value))
                  }
                  min={1}
                  disabled={polling}
                />
              </div>
            )}
          </div>

          {/* Calculated Breakdown Display */}
          {pricing && (
            <div style={styles.pricingBox}>
              <div style={styles.priceRow}>
                <span>Subtotal:</span>
                <strong>₹{pricing.totalAmount || pricing.subtotal || 0}</strong>
              </div>
            </div>
          )}

          {/* Payment Link Fallback */}
          {paymentLink && (
            <div style={styles.linkBox}>
              <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                If popup didn't open, use this link:
              </span>
              <a
                href={paymentLink}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.paymentLink}
              >
                Open Payment Page →
              </a>
            </div>
          )}

          {/* Status Message */}
          {statusLog && <div style={styles.statusBox}>{statusLog}</div>}
        </div>

        {/* Footer Action Buttons */}
        <div style={styles.footer}>
          {polling ? (
            <button style={styles.secBtn} onClick={handleStopPolling}>
              Stop Polling
            </button>
          ) : (
            <>
              <button
                style={styles.secBtn}
                onClick={handleCalculatePrice}
                disabled={loading}
              >
                Calculate Price
              </button>

              <button
                style={styles.primaryBtn}
                onClick={handleInitiatePayment}
                disabled={loading}
              >
                {loading ? "Processing..." : "Pay with Razorpay"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Inline Styles (Clean & Frameless dark UI)
const styles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    padding: "16px",
  },
  modal: {
    backgroundColor: "#1e293b",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "500px",
    color: "#f8fafc",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    overflow: "hidden",
  },
  header: {
    padding: "20px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: "18px",
    fontWeight: "600",
    margin: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: "20px",
    cursor: "pointer",
  },
  body: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  row: {
    display: "flex",
    gap: "12px",
  },
  label: {
    fontSize: "13px",
    color: "#94a3b8",
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#0f172a",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
  },
  select: {
    backgroundColor: "#0f172a",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
  },
  pricingBox: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    borderRadius: "8px",
    padding: "12px 16px",
    fontSize: "14px",
  },
  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkBox: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: "8px",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  paymentLink: {
    color: "#22c55e",
    fontSize: "14px",
    fontWeight: "500",
    textDecoration: "underline",
  },
  statusBox: {
    backgroundColor: "#0f172a",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#38bdf8",
    fontFamily: "monospace",
  },
  footer: {
    padding: "16px 20px",
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  },
  secBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "10px 16px",
    color: "#fff",
    fontWeight: "500",
    cursor: "pointer",
  },
  primaryBtn: {
    backgroundColor: "#6366f1",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    color: "#fff",
    fontWeight: "600",
    cursor: "pointer",
  },
};

export default CardsCreditPurchaseModal;
