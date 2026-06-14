import axios from "axios";

const sendEmail = async (to) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: "miniGram", email: process.env.BREVO_EMAIL },
        to: [{ email: to }],
        subject: "Your miniGram OTP",
        htmlContent: `<div style="font-family:Arial;text-align:center;padding:30px;">
          <h2 style="color:#7c3aed;">miniGram Verification</h2>
          <h1 style="letter-spacing:8px;color:#7c3aed;">${otp}</h1>
          <p style="color:#dc2626;">Expires in 5 minutes</p>
        </div>`,
        textContent: `Your miniGram OTP is: ${otp}\nExpires in 5 minutes.`,
      },
      { headers: { "api-key": process.env.BREVO_API_KEY } }
    );
    return otp;
  } catch (err) {
    console.error("Brevo error:", err.response?.data || err.message);
    return null;
  }
};

export default sendEmail;
