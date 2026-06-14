import mongoose from "mongoose";
import Loop from "../models/loop.model.js";


export const validateLoopUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: "Upload a video file" });
  }


  if (!req.file.mimetype.startsWith("video/")) {
    return res.status(400).json({ message: "Only video files are allowed for loops" });
  }

  next();
};


export const isLoopAuthor = async (req, res, next) => {
  try {
    const { loopId } = req.params;

    if (!loopId) {
      return res.status(400).json({ message: "Loop ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(loopId)) {
      return res.status(400).json({ message: "Invalid Loop ID" });
    }

    const loop = await Loop.findById(loopId);
    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    if (loop.author.toString() !== req.userId.toString()) {
      return res.status(403).json({
        message: "You are not authorized to modify this loop",
      });
    }

    
    req.loop = loop;
    next();
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error in middleware: ${error.message}`,
    });
  }
};
