import axios from "axios";

const sendEmail = async (to) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const emailUser =
      process.env.EMAIL_USER?.trim() ||
      process.env.BREVO_EMAIL?.trim();

    const brevoApiKey =
      process.env.BREVO_API_KEY?.trim() ||
      process.env.BREVO_SMTP_KEY?.trim();

    if (!emailUser || !brevoApiKey) {
      throw new Error("Brevo credentials missing");
    }

    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "miniGram",
          email: emailUser,
        },
        to: [{ email: to }],
        subject: "Verify Your Email - miniGram",
        htmlContent: `
          <div style="max-width:500px;margin:auto;padding:30px;background:#f8f9fa;border-radius:12px;font-family:Arial,sans-serif;text-align:center;">
            
            <h2 style="color:#7c3aed;">
              miniGram Email Verification
            </h2>

            <p>
              Use the OTP below to verify your email address.
            </p>

            <div style="margin:25px 0;padding:20px;background:white;border:2px dashed #7c3aed;border-radius:10px;">
              <h1 style="margin:0;font-size:38px;color:#7c3aed;letter-spacing:8px;">
                ${otp}
              </h1>
            </div>

            <p style="color:#dc2626;font-weight:bold;">
              OTP expires in 5 minutes
            </p>

            <p style="color:#6b7280;font-size:14px;">
              Do not share this code with anyone.
            </p>

            <hr style="margin:25px 0;">

            <p style="font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} miniGram
            </p>

          </div>
        `,
      },
      {
        headers: {
          accept: "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
      }
    );

    console.log(`OTP sent to ${to}`);

    return otp;
  } catch (error) {
    console.error(
      "Brevo Error:",
      error.response?.data || error.message
    );

    return null;
  }
};

export default sendEmail;
