import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  auth: {
    user: process.env.BREVO_EMAIL,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

const sendEmail = async (to) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    await transporter.sendMail({
      from: `"miniGram" <${process.env.BREVO_EMAIL}>`,
      to,
      subject: "Verify Your Email - miniGram",
      text: `Your OTP is ${otp}`,
      html: `
        <div style="max-width:500px;margin:0 auto;padding:30px;background:#f8f9fa;border-radius:12px;border:1px solid #e5e7eb;font-family:Arial,sans-serif;text-align:center;">
          <h2 style="color:#7c3aed;">miniGram Email Verification</h2>
          <p style="color:#4b5563;font-size:16px;">Use the OTP below to verify your email address.</p>
          <div style="margin:25px 0;padding:20px;background:white;border:2px dashed #7c3aed;border-radius:10px;">
            <h1 style="margin:0;font-size:38px;color:#7c3aed;letter-spacing:8px;">${otp}</h1>
          </div>
          <p style="color:#dc2626;font-weight:bold;">OTP expires in 5 minutes</p>
          <p style="color:#6b7280;font-size:14px;">Do not share this code with anyone. miniGram will never ask for your OTP.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:25px 0;">
          <p style="color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} miniGram. All rights reserved.</p>
        </div>
      `,
    });
    console.log("✅ OTP sent to:", to);
    return otp;
  } catch (error) {
    console.error("❌ Send mail error:", JSON.stringify(error, null, 2));
    return null;
  }
};

export default sendEmail;
