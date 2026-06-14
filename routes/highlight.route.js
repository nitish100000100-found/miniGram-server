import express from "express";
import isAuth from "../middleware/isAuth.middleware.js";
import { upload } from "../config/cloudinary.js";
import {
  deleteHighlight,
  deleteStoryFromHighlight,
  renameHighlight,
  addStoryToHighlight,
  createHighlightFromStory,
  getInfoOfOneHighlight,
  updateHighlightCover,
  removeHighlightCover,
} from "../controllers/highlight.controllers.js";

const highlightRouter = express.Router();

highlightRouter.get("/oneHighlight/:highlightId", isAuth, getInfoOfOneHighlight);
highlightRouter.post("/add-story/:highlightId", isAuth, addStoryToHighlight);

highlightRouter.post(
  "/create-from-story",
  isAuth,
  upload.single("coverImage"),
  createHighlightFromStory,
);

highlightRouter.post("/:highlightId/rename", isAuth, renameHighlight);

highlightRouter.post(
  "/:highlightId/update-cover",
  isAuth,
  upload.single("coverImage"),
  updateHighlightCover,
);

highlightRouter.post("/:highlightId/remove-cover", isAuth, removeHighlightCover);

highlightRouter.post(
  "/:highlightId/story/:storyIdInHighlight",
  isAuth,
  deleteStoryFromHighlight,
);

highlightRouter.post("/:highlightId", isAuth, deleteHighlight);

export default highlightRouter;
