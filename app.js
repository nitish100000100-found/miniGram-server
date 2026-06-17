import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import postRouter from "./routes/post.route.js";
import interactionRouter from "./routes/interaction.route.js";
import loopRouter from "./routes/loop.route.js";
import storyRouter from "./routes/story.route.js";
import highlightRouter from "./routes/highlight.route.js";
import messageRouter from "./routes/message.route.js";

import errorHandler from "./middleware/error.middleware.js";

const app = express();

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS.split(","),
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MiniGram API is running 🚀",
  });
});


app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);
app.use("/api/interaction", interactionRouter);
app.use("/api/loop", loopRouter);
app.use("/api/story", storyRouter);
app.use("/api/highlight", highlightRouter);
app.use("/api/message", messageRouter);


app.use(errorHandler);

export default app;
