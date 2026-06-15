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
          <h2>miniGram Email Verification</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>OTP expires in 5 minutes.</p>
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
