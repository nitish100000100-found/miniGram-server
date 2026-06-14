import express from "express";
import isAuth from "../middleware/isAuth.middleware.js";
import { upload } from "../config/cloudinary.js";
import {
  uploadPost,
  deletePost,
  savePost,
  getFeedPosts,
  getExplorePosts,
  getSavedPosts,
  getPostComments,
} from "../controllers/post.controllers.js";

const postRouter = express.Router();

postRouter.post("/upload", isAuth, upload.single("media"), uploadPost);
postRouter.post("/delete/:postId", isAuth, deletePost);
postRouter.post("/save/:postId", isAuth, savePost);
postRouter.get("/feed", isAuth, getFeedPosts);
postRouter.get("/explore", isAuth, getExplorePosts);
postRouter.get("/saved", isAuth, getSavedPosts);
postRouter.get("/getallcomments/:postId", isAuth, getPostComments);

export default postRouter;