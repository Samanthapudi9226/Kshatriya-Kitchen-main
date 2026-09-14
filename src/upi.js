export const PAYMENT_STATUS = {
  PENDING: "Payment Verification Pending",
  CONFIRMED: "Payment Confirmed",
  REJECTED: "Payment Rejected"
};

export function isUpiEnabled(settings) {
  return Boolean(settings?.upiEnabled);
}

export function getUpiQr(settings) {
  return settings?.upiQr || "";
}

export function getUpiId(settings) {
  return settings?.upiId || "";
}

export function readQrFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No QR image selected."));
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(new Error("Please select an image file."));
      return;
    }

    // Keep localStorage from becoming unnecessarily large.
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("QR image must be smaller than 5 MB."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error("Could not read the QR image."));
    };

    reader.readAsDataURL(file);
  });
}

export function createUpiPayment({
  transactionId,
  amount,
  upiId
}) {
  return {
    method: "UPI",
    transactionId: String(transactionId || "").trim(),
    amount: Number(amount || 0),
    upiId: String(upiId || "").trim(),
    status: PAYMENT_STATUS.PENDING
  };
}

export function isValidTransactionId(transactionId) {
  return String(transactionId || "").trim().length >= 4;
}