import dotenv from "dotenv";
import sendEmail from "./config/mail.js";

dotenv.config({ path: "/home/nitish/vs/minigramSep/miniGram-server/.env" });

console.log("EMAIL_USER:", process.env.EMAIL_USER?.trim());
console.log("BREVO_API_KEY:", process.env.BREVO_API_KEY ? "exists" : "missing");

const test = async () => {
  console.log("Attempting to send a test verification email via Brevo...");
  // Sending to a test address
  const otp = await sendEmail("testotpuser@gmail.com");
  if (otp) {
    console.log("Test OTP sent successfully:", otp);
  } else {
    console.error("Test OTP sending failed.");
  }
  process.exit(0);
};

test();
