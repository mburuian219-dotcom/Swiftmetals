import Africastalking from "africastalking";

// ⚠️ Ensure these are set in your .env.local
const credentials = {
  apiKey: process.env.AT_API_KEY!,
  username: process.env.AT_USERNAME!,
};

const africastalking = Africastalking(credentials);
const sms = africastalking.SMS;

interface SMSResult {
  success: number;
  failed: number;
  failedRecipients: { number: string; error: string }[];
  blacklist?: boolean; // 👈 add blacklist flag
}

/**
 * Send SMS to one or multiple phone numbers.
 * Validates Kenyan numbers before sending.
 */
export async function sendSMS(
  to: string | string[],
  message: string
): Promise<SMSResult> {
  // Normalize numbers
  const numbers = Array.isArray(to) ? to : [to];

  const validNumbers: string[] = [];
  const invalidNumbers: { number: string; reason: string }[] = [];

  for (const n of numbers) {
    if (!n) {
      invalidNumbers.push({ number: n, reason: "Empty" });
      continue;
    }

    const cleaned = n.trim();
    if (cleaned.startsWith("07")) {
      validNumbers.push("+254" + cleaned.slice(1));
    } else if (cleaned.startsWith("+254")) {
      validNumbers.push(cleaned);
    } else {
      invalidNumbers.push({ number: n, reason: "Invalid format" });
    }
  }

  if (validNumbers.length === 0) {
    console.warn("⚠️ No valid phone numbers to send SMS", invalidNumbers);
    return {
      success: 0,
      failed: invalidNumbers.length,
      failedRecipients: invalidNumbers.map((n) => ({
        number: n.number,
        error: n.reason,
      })),
    };
  }

  const options: { to: string[]; message: string } = {
    to: validNumbers,
    message,
  };

  try {
    const response = await sms.send(options);

    console.log("✅ SMS API Response:");
    console.dir(response, { depth: null });

    const recipients = response.SMSMessageData.Recipients || [];

    let blacklistHit = false;

    const successCount = recipients.filter(
      (r: any) => r.status === "Success"
    ).length;

    const failedRecipients = recipients
      .filter((r: any) => r.status !== "Success")
      .map((r: any) => {
        if (r.status === "UserInBlacklist") {
          blacklistHit = true;
        }
        return {
          number: r.number,
          error: r.errorMessage || r.status || "Unknown error",
        };
      });

    return {
      success: successCount,
      failed: failedRecipients.length + invalidNumbers.length,
      failedRecipients: [
        ...failedRecipients,
        ...invalidNumbers.map((n) => ({
          number: n.number,
          error: n.reason,
        })),
      ],
      blacklist: blacklistHit,
    };
  } catch (error: any) {
    console.error("❌ Failed to send SMS:", error);

    return {
      success: 0,
      failed: validNumbers.length + invalidNumbers.length,
      failedRecipients: [
        ...validNumbers.map((num) => ({ number: num, error: error.message })),
        ...invalidNumbers.map((n) => ({
          number: n.number,
          error: n.reason,
        })),
      ],
    };
  }
}
