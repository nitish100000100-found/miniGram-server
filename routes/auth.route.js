import express from "express";
import { signUp, signIn,logOut, sentOtp, verifyOtp, forgotPassword,sendSignupOtp, changePassword } from "../controllers/auth.controllers.js";
import isAuth from "../middleware/isAuth.middleware.js";

const authRouter = express.Router();

authRouter.post("/signin", signIn);
authRouter.post("/signup", signUp);
authRouter.post("/logout", logOut);
authRouter.post("/send-otp", sentOtp);
authRouter.post("/verify-otp", verifyOtp);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/send-signup-otp", sendSignupOtp);
authRouter.post("/change-password", isAuth, changePassword);

export default authRouter;