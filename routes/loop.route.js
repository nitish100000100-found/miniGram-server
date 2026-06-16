import express from "express";
import { upload } from "../config/cloudinary.js";
import isAuth from "../middleware/isAuth.middleware.js";
import {
  uploadLoop,
  deleteLoop,
  likeLoop,
  commentLoop,
  deleteCommentLoop,
  getLoops,
  getLoopById,
  getUserLoops,
  getWhoLikedLoop,
  getLoopComments,
  saveLoop,
  getSavedLoops,
  getExploreLoops,
} from "../controllers/loop.controllers.js";

const loopRouter = express.Router();

loopRouter.post("/upload", isAuth, upload.single("video"), uploadLoop);
loopRouter.post("/delete/:loopId", isAuth, deleteLoop);
loopRouter.post("/like/:loopId", isAuth, likeLoop);
loopRouter.post("/comment/:loopId", isAuth, commentLoop);
loopRouter.post("/comment/delete/:loopId/:commentId", isAuth, deleteCommentLoop);
loopRouter.post("/save/:loopId", isAuth, saveLoop);
loopRouter.get("/saved/all", isAuth, getSavedLoops);
loopRouter.get("/explore/all", isAuth, getExploreLoops);
loopRouter.get("/all", isAuth, getLoops);
loopRouter.get("/user/:userId", isAuth, getUserLoops);
loopRouter.get("/whoLiked/:loopId", isAuth, getWhoLikedLoop);
loopRouter.get("/getallcomments/:loopId", isAuth, getLoopComments);
loopRouter.get("/:loopId", isAuth, getLoopById);

export default loopRouter;
