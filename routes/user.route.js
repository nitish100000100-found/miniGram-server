import express from "express";

import isAuth from "../middleware/isAuth.middleware.js";
import { getCurrentUser,suggestedUsers,editProfile,lookFor,getFollowingStoriesUsers, switchToPublic, switchToPrivate, getFollowers, getFollowing } from "../controllers/user.controller.js";
import {
  upload
} from "../config/cloudinary.js";
const userRouter = express.Router();
userRouter.get("/current",isAuth, getCurrentUser);
userRouter.get("/suggested", isAuth, suggestedUsers);
userRouter.post("/editProfile", isAuth,upload.single("profilepic"), editProfile);
userRouter.get("/lookFor/:id",isAuth, lookFor);
userRouter.get("/otherUsersWithStory", isAuth, getFollowingStoriesUsers);
userRouter.post("/switch-to-public", isAuth, switchToPublic);
userRouter.post("/switch-to-private", isAuth, switchToPrivate);
userRouter.get("/getFollowers/:id", isAuth, getFollowers);
userRouter.get("/getFollowing/:id", isAuth, getFollowing);

export default userRouter;


