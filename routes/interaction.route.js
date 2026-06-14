import express from "express";
import isAuth from "../middleware/isAuth.middleware.js";
import {
  likePost,
  blockUser,
  unblockUser,
  comment,
  deleteComment,
  sendFollowRequest,
  unFollowSomeOne,
  cancelSendedFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  getPendingRequests,
  getWhoLikedPost,
  removeFollower,
} from "../controllers/interaction.controllers.js";

const interactionRouter = express.Router();

// Block / Unblock
interactionRouter.post("/block/:id", isAuth, blockUser);
interactionRouter.post("/unblock/:id", isAuth, unblockUser);

// Post interactions (Likes and Comments)
interactionRouter.post("/like/:postId", isAuth, likePost);
interactionRouter.post("/comment/:postId", isAuth, comment);
interactionRouter.post(
  "/delete-comment/:postId/:commentId",
  isAuth,
  deleteComment,
);
interactionRouter.get("/whoLiked/:postId", isAuth, getWhoLikedPost);

// Follow management
interactionRouter.post("/followsomeone/:id", isAuth, sendFollowRequest);
interactionRouter.post("/unfollowsomeone/:id", isAuth, unFollowSomeOne);
//cancel mai khud ka he khud request reject krta hu
interactionRouter.post("/cancelsendrequest/:id", isAuth, cancelSendedFollowRequest);
interactionRouter.post("/acceptrequest/:id", isAuth, acceptFollowRequest);
//reject is done by other
interactionRouter.post("/rejectrequest/:id", isAuth, rejectFollowRequest);
interactionRouter.post("/removefollower/:id", isAuth, removeFollower);

interactionRouter.get("/pendingrequests", isAuth, getPendingRequests);

export default interactionRouter;
