import express from "express";
import { upload } from "../config/cloudinary.js";
import isAuth from "../middleware/isAuth.middleware.js";
import { validateLoopUpload, isLoopAuthor } from "../middleware/loop.middleware.js";
import {
  uploadLoop,
  deleteLoop,
  updateLoop,
  likeLoop,
  commentLoop,
  deleteCommentLoop,
  getLoops,
  getLoopById,
} from "../controllers/loop.controllers.js";

const loopRouter = express.Router();

loopRouter.post("/upload", isAuth, upload.single("video"), validateLoopUpload, uploadLoop);
loopRouter.post("/delete/:loopId", isAuth, isLoopAuthor, deleteLoop);
loopRouter.post("/update/:loopId", isAuth, isLoopAuthor, updateLoop);
loopRouter.post("/like/:loopId", isAuth, likeLoop);
loopRouter.post("/comment/:loopId", isAuth, commentLoop);
loopRouter.post("/comment/delete/:loopId/:commentId", isAuth, deleteCommentLoop);
loopRouter.get("/all", isAuth, getLoops);
loopRouter.get("/:loopId", getLoopById);

export default loopRouter;
