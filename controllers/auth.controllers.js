import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import genToken from "../config/token.js";
import sendEmail from "../config/mail.js";
import OTP from "../models/otp.model.js";

const signUp = async (req, res) => {
  try {
    const { name, username, email, password, otp } = req.body;

    if (!name || !username || !email || !password || !otp) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return res
        .status(400)
        .json({ message: "OTP not found. Please verify email first." });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ email });
      return res
        .status(400)
        .json({ message: "OTP expired. Please request a new one." });
    }

    const isOtpMatch = await bcrypt.compare(otp, otpRecord.otp);
    if (!isOtpMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (!otpRecord.isVerified) {
      return res
        .status(400)
        .json({ message: "Email not verified. Please verify OTP first." });
    }

    const findByEmail = await User.findOne({ email });
    if (findByEmail) {
      return res
        .status(400)
        .json({ message: "User with this email already exists !" });
    }

    const findByUserName = await User.findOne({ username });
    if (findByUserName) {
      return res
        .status(400)
        .json({ message: "User with this username already exists !" });
    }

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long !" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      username,
      email,
      password: hashedPassword,
    });
    await newUser.save();

    await OTP.deleteOne({ email });

    const token = await genToken(newUser._id);
    if(!token){
      return res.status(500).json({message: "Internal server error while generating token"})
    }
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const createdUser = await User.findById(newUser._id).select("-password");
    return res.status(201).json(createdUser);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const signIn = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    let isMatch = false;
    if (user) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Fake compare to prevent timing differences
      await bcrypt.compare("fake_password", "$2b$10$abcdefghijklmnopqrstuv");
    }

    if (!user || !isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const token = await genToken(user._id);
    if(!token){
      return res.status(500).json({message: "Internal server error while generating token"})
    }
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    const userWithoutPassword = await User.findById(user._id).select(
      "-password",
    );
    return res.status(200).json(userWithoutPassword);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};
const logOut = (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });
    return res.status(200).json({ message: "Logged out successfully !" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const sentOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({ message: "If your email is registered, an OTP has been sent!" });
    }

    const otp = await sendEmail(email);

    if (!otp) {
      return res
        .status(500)
        .json({ message: "Failed to send OTP. Please try again." });
    }
    const hashedOtp = await bcrypt.hash(otp, 10);

    await OTP.findOneAndUpdate(
      { email },
      {
        $set: {
          otp: hashedOtp,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          isVerified: false,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    return res.status(200).json({ message: "If your email is registered, an OTP has been sent!" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return res
        .status(400)
        .json({ message: "OTP not found. Please request a new one." });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ email });
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }

    const isOtpMatch = await bcrypt.compare(otp, otpRecord.otp);
    if (!isOtpMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    otpRecord.isVerified = true;
    await otpRecord.save();

    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};
const forgotPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    if (!otp) {
      return res.status(400).json({
        message: "OTP is required",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        message: "New password is required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    const otpRecord = await OTP.findOne({ email });

    if (!otpRecord) {
      return res.status(400).json({
        message: "OTP not found",
      });
    }

    if (!otpRecord.isVerified) {
      return res.status(400).json({
        message: "Please verify OTP first",
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ email });

      return res.status(400).json({
        message: "OTP expired",
      });
    }

    const isOtpMatch = await bcrypt.compare(otp, otpRecord.otp);

    if (!isOtpMatch) {
      return res.status(400).json({
        message: "Invalid OTP",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User with this email does not exist!",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save();

    await OTP.deleteOne({ email });

    const token = await genToken(user._id);
    if (!token) {
      return res.status(500).json({ message: "Internal server error while generating token" });
    }

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const updatedUser = await User.findById(user._id).select("-password");

    return res.status(200).json({
      message: "Password reset successfully!",
      user: updatedUser,
    });
  } catch (error) {
     console.log("at forget pass catch")
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const sendSignupOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({
        message: "Email is already registered",
      });
    }

    const otp = await sendEmail(email);

    if (!otp) {
      return res.status(500).json({
        message: "Failed to send OTP. Please try again.",
      });
    }

    const hashedOtp = await bcrypt.hash(otp, 10);

    await OTP.findOneAndUpdate(
      { email },
      {
        $set: {
          otp: hashedOtp,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          isVerified: false,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );

    return res.status(200).json({
      message: "OTP sent successfully!",
    });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Both current and new passwords are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long",
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Incorrect current password",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      message: "Password changed successfully!",
    });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

export {
  signUp,
  signIn,
  logOut,
  sentOtp,
  verifyOtp,
  forgotPassword,
  sendSignupOtp,
  changePassword,
};

