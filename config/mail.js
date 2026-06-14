import nodemailer from "nodemailer";
console.log("EMAIL_USER:", !!process.env.EMAIL_USER);
console.log("CLIENT_ID:", !!process.env.CLIENT_ID);
console.log("CLIENT_SECRET:", !!process.env.CLIENT_SECRET);
console.log("REFRESH_TOKEN:", !!process.env.REFRESH_TOKEN);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process?.env?.EMAIL_USER,
    clientId: process?.env?.CLIENT_ID,
    clientSecret: process?.env?.CLIENT_SECRET,
    refreshToken: process?.env?.REFRESH_TOKEN,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error("Error connecting to email server:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

const sendEmail = async (to) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const info = await transporter.sendMail({
      from: `"miniGram" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Verify Your Email - miniGram",
      text: `Your OTP is ${otp}`,

      html: `
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
`,
    });

    return otp;
  } catch (error) {
    return null;
  }
};

export default sendEmail;
