import express from "express";
import isAuth from "../middleware/isAuth.middleware.js";
import { upload } from "../config/cloudinary.js";
import { addStory, deleteStory, getOneStory, getAllStories} from "../controllers/story.controllers.js";

const storyRouter = express.Router();

storyRouter.post("/addStory", isAuth, upload.single("media"), addStory);
storyRouter.post("/deleteStory/:storyId", isAuth, deleteStory);
storyRouter.get("/oneStory/:storyId", isAuth, getOneStory);
storyRouter.get("/allStories/:targetUserId", isAuth, getAllStories);

export default storyRouter;
