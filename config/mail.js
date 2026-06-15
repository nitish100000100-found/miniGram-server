import axios from "axios";

const sendEmail = async (to) => {
  try {
    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const senderEmail = process.env.BREVO_EMAIL?.trim();
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();

    if (!senderEmail || !brevoApiKey) {
      throw new Error("Brevo credentials missing");
    }

    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "miniGram",
          email: senderEmail,
        },
        to: [{ email: to }],
        subject: "Verify Your Email - miniGram",
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Email Verification</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        
        <table
          width="600"
          cellpadding="0"
          cellspacing="0"
          style="
            background:#ffffff;
            border-radius:16px;
            overflow:hidden;
            box-shadow:0 4px 20px rgba(0,0,0,0.08);
          "
        >
          
          <!-- Header -->
          <tr>
            <td
              align="center"
              style="
                background:linear-gradient(135deg,#7c3aed,#6d28d9);
                padding:35px;
              "
            >
              <h1
                style="
                  margin:0;
                  color:white;
                  font-size:32px;
                  font-weight:bold;
                "
              >
                miniGram
              </h1>

              <p
                style="
                  margin-top:8px;
                  color:#e9d5ff;
                  font-size:14px;
                "
              >
                Connect • Share • Inspire
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px 30px;text-align:center;">
              
              <h2
                style="
                  color:#1f2937;
                  margin-bottom:15px;
                "
              >
                Verify Your Email Address
              </h2>

              <p
                style="
                  color:#6b7280;
                  font-size:16px;
                  line-height:1.6;
                  margin-bottom:25px;
                "
              >
                Welcome to <strong>miniGram</strong> 🎉
                <br />
                Use the verification code below to complete your registration.
              </p>

              <div
                style="
                  display:inline-block;
                  background:#f3f4ff;
                  border:2px dashed #7c3aed;
                  border-radius:12px;
                  padding:18px 35px;
                  margin:10px 0 25px;
                "
              >
                <h1
                  style="
                    margin:0;
                    color:#7c3aed;
                    font-size:40px;
                    letter-spacing:8px;
                  "
                >
                  ${otp}
                </h1>
              </div>

              <p
                style="
                  color:#6b7280;
                  font-size:15px;
                "
              >
                This OTP will expire in
                <strong>5 minutes</strong>.
              </p>

              <p
                style="
                  margin-top:30px;
                  color:#9ca3af;
                  font-size:13px;
                  line-height:1.5;
                "
              >
                If you did not request this verification code,
                please ignore this email.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td
              align="center"
              style="
                background:#f9fafb;
                padding:20px;
                border-top:1px solid #e5e7eb;
              "
            >
              <p
                style="
                  margin:0;
                  color:#9ca3af;
                  font-size:12px;
                "
              >
                © 2026 miniGram. All rights reserved.
              </p>

              <p
                style="
                  margin-top:6px;
                  color:#9ca3af;
                  font-size:12px;
                "
              >
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`,
      },
      {
        headers: {
          "api-key": brevoApiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
      }
    );

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
