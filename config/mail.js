import dotenv from "dotenv";

const sendEmail = async (to) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const emailUser = process.env.EMAIL_USER?.trim() || process.env.BREVO_EMAIL?.trim();
  // Brevo API Key and SMTP Key are the same v3 key string (xkeysib-...)
  const brevoApiKey = process.env.BREVO_API_KEY?.trim() || process.env.BREVO_SMTP_KEY?.trim();

  if (!brevoApiKey) {
    console.error("Error: BREVO_API_KEY or BREVO_SMTP_KEY is missing in environment variables.");
    return null;
  }

  if (!emailUser) {
    console.error("Error: EMAIL_USER or BREVO_EMAIL is missing in environment variables.");
    return null;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: { name: "miniGram", email: emailUser },
        to: [{ email: to }],
        subject: "Verify Your Email - miniGram",
        htmlContent: `
<div style="
  max-width: 500px;
  margin: 0 auto;
  padding: 30px;
  background: #f8f9fa;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  font-family: Arial, sans-serif;
  text-align: center;
">
  <h2 style="
    color: #7c3aed;
    margin-bottom: 20px;
  ">
    miniGram Email Verification
  </h2>

  <p style="
    color: #4b5563;
    font-size: 16px;
  ">
    Use the OTP below to verify your email address.
  </p>

  <div style="
    margin: 25px 0;
    padding: 20px;
    background: white;
    border: 2px dashed #7c3aed;
    border-radius: 10px;
  ">
    <h1 style="
      margin: 0;
      font-size: 38px;
      color: #7c3aed;
      letter-spacing: 8px;
    ">
      ${otp}
    </h1>
  </div>

  <p style="
    color: #dc2626;
    font-weight: bold;
    margin-bottom: 20px;
  ">
    OTP expires in 5 minutes
  </p>

  <p style="
    color: #6b7280;
    font-size: 14px;
    line-height: 1.6;
  ">
    Do not share this code with anyone.
    miniGram will never ask for your OTP.
  </p>

  <hr style="
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 25px 0;
  ">

  <p style="
    color: #9ca3af;
    font-size: 12px;
    margin: 0;
  ">
    © ${new Date().getFullYear()} miniGram. All rights reserved.
  </p>
</div>
`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Brevo API error:", data);
      return null;
    }

    console.log("Email sent successfully via Brevo API:", data);
    return otp;
  } catch (error) {
    console.error("Error sending email via Brevo:", error);
    return null;
  }
};

export default sendEmail;
