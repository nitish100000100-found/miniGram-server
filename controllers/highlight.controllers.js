import mongoose from "mongoose";
import Highlight from "../models/highlight.model.js";
import User from "../models/user.model.js";
import Story from "../models/story.model.js";
import { uploadToCloudinary, cloudinary } from "../config/cloudinary.js";
import path from "path";

const deleteHighlight = async (req, res) => {
  try {
    const { highlightId } = req.params;
    const userId = req.userId;

    if (!highlightId || !mongoose.Types.ObjectId.isValid(highlightId)) {
      return res.status(400).json({ message: "Invalid Highlight ID" });
    }

    const highlight = await Highlight.findById(highlightId);
    if (!highlight) {
      return res.status(404).json({ message: "Highlight not found" });
    }

    if (highlight.author.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You are not authorized to modify this highlight",
      });
    }

    // 1. Delete all story assets from Cloudinary
    const deletePromises = highlight.stories.map((story) => {
      return cloudinary.uploader.destroy(story.publicId, {
        resource_type: story.mediaType === "video" ? "video" : "image",
      });
    });

    // 2. Delete cover image from Cloudinary if it is different
    const storyPublicIds = highlight.stories.map((s) => s.publicId);
    if (
      highlight.coverImagePublicId &&
      !storyPublicIds.includes(highlight.coverImagePublicId)
    ) {
      deletePromises.push(
        cloudinary.uploader.destroy(highlight.coverImagePublicId),
      );
    }

    await Promise.all(deletePromises);

    // 3. Remove highlight from User model
    await User.findByIdAndUpdate(userId, {
      $pull: { highlights: highlight._id },
    });

    // 4. Delete document
    await highlight.deleteOne();

    return res
      .status(200)
      .json({
        message: "Highlight and all associated media deleted successfully",
      });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const deleteStoryFromHighlight = async (req, res) => {
  try {
    const { highlightId, storyIdInHighlight } = req.params;
    const userId = req.userId;

    if (!highlightId || !mongoose.Types.ObjectId.isValid(highlightId)) {
      return res.status(400).json({ message: "Invalid Highlight ID" });
    }

    const highlight = await Highlight.findById(highlightId);
    if (!highlight) {
      return res.status(404).json({ message: "Highlight not found" });
    }

    if (highlight.author.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You are not authorized to modify this highlight",
      });
    }

    if (!storyIdInHighlight) {
      return res
        .status(400)
        .json({ message: "Story ID within highlight is required" });
    }

    const story = highlight.stories.find(
      (s) => s._id.toString() === storyIdInHighlight.toString(),
    );

    if (!story) {
      return res
        .status(404)
        .json({ message: "Story not found in this highlight" });
    }

    // 1. Delete the media asset from Cloudinary
    await cloudinary.uploader.destroy(story.publicId, {
      resource_type: story.mediaType === "video" ? "video" : "image",
    });

    // 2. Remove story from highlight list
    highlight.stories = highlight.stories.filter(
      (s) => s._id.toString() !== storyIdInHighlight.toString(),
    );

    if (highlight.stories.length === 0) {
  
      if (highlight.coverImagePublicId) {
        try {
          await cloudinary.uploader.destroy(highlight.coverImagePublicId);
        } catch (err) {
          console.error("Failed to delete cover image on auto-delete:", err.message);
        }
      }

      // Delete the entire highlight if no stories remain
      await User.findByIdAndUpdate(userId, {
        $pull: { highlights: highlight._id },
      });
      await highlight.deleteOne();
      return res.status(200).json({
        message: "Highlight deleted as it has no stories left",
        highlightDeleted: true,
      });
    }

    // Update cover image if the deleted story was the cover image
    const isCoverImageDeleted =
      highlight.coverImagePublicId === story.publicId ||
      highlight.coverImage === story.mediaUrl;

    if (isCoverImageDeleted || !highlight.coverImage) {
      highlight.coverImage = highlight.stories[0].mediaUrl;
      highlight.coverImagePublicId = highlight.stories[0].publicId;
    }

    await highlight.save();

    const responseHighlight = highlight.toObject();
    delete responseHighlight.coverImagePublicId;
    if (responseHighlight.stories) {
      responseHighlight.stories.forEach((s) => {
        delete s.publicId;
      });
    }

    return res.status(200).json({
      message: "Story removed from highlight successfully",
      highlight: responseHighlight,
    });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const renameHighlight = async (req, res) => {
  try {
    const { highlightId } = req.params;
    const { title } = req.body;
    const userId = req.userId;

    if (!highlightId || !mongoose.Types.ObjectId.isValid(highlightId)) {
      return res.status(400).json({ message: "Invalid Highlight ID" });
    }

    const highlight = await Highlight.findById(highlightId);
    if (!highlight) {
      return res.status(404).json({ message: "Highlight not found" });
    }

    if (highlight.author.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You are not authorized to modify this highlight",
      });
    }

    if (!title || !title.trim()) {
      return res
        .status(400)
        .json({ message: "New highlight title is required" });
    }

    highlight.title = title.trim();
    await highlight.save();

    const responseHighlight = highlight.toObject();
    delete responseHighlight.coverImagePublicId;
    if (responseHighlight.stories) {
      responseHighlight.stories.forEach((s) => {
        delete s.publicId;
      });
    }

    return res.status(200).json({
      message: "Highlight renamed successfully",
      highlight: responseHighlight,
    });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const addStoryToHighlight = async (req, res) => {
  try {
    const { highlightId } = req.params;
    const { storyId } = req.body;
    const userId = req.userId;

    if (!highlightId || !mongoose.Types.ObjectId.isValid(highlightId)) {
      return res.status(400).json({ message: "Invalid Highlight ID" });
    }
    if (!storyId || !mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ message: "Invalid Story ID" });
    }

    const [highlight, story] = await Promise.all([
      Highlight.findById(highlightId),
      Story.findById(storyId),
    ]);

    if (!highlight) {
      return res.status(404).json({ message: "Highlight not found" });
    }
    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    if (highlight.author.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You are not authorized to modify this highlight",
      });
    }
    if (story.author.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You do not own this story",
      });
    }

    const alreadyExists = highlight.stories.some(
      (s) => s.publicId === story.mediaPublicId,
    );
    if (alreadyExists) {
      return res
        .status(400)
        .json({ message: "Story already exists in this highlight" });
    }

    const storyUniqueName = `highlight_story_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    const uploadResult = await cloudinary.uploader.upload(story.mediaUrl, {
      public_id: storyUniqueName,
      resource_type: story.mediaType === "video" ? "video" : "image",
    });

    highlight.stories.push({
      mediaType: story.mediaType,
      mediaUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });

    await highlight.save();

    return res.status(200).json({
      message: "Story added to highlight successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const createHighlightFromStory = async (req, res) => {
  let uploadedPublicId = null;
  try {
    const userId = req.userId;
    const { title, storyId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Highlight title is required" });
    }
    if (!storyId || !mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ message: "Story ID is required" });
    }

    const [user, story] = await Promise.all([
      User.findById(userId),
      Story.findById(storyId),
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }
    if (story.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You do not own this story" });
    }

    let coverImage = null;
    let coverImagePublicId = null;

    if (req.file) {
      const originalName = req.file.originalname
        ? path.parse(req.file.originalname).name
        : "media";
      const cleanName = originalName
        .replace(/\s+/g, "_")
        .replace(/[^\w\-]/g, "");
      const uniqueName = `${user.username}_highlight_cover_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}_${cleanName}`;

      const result = await uploadToCloudinary(req.file.buffer, uniqueName);
      coverImage = result.secure_url;
      coverImagePublicId = result.public_id;
      uploadedPublicId = result.public_id;
    }

    let storyUniqueName = `highlight_story_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;
      
    const uploadResult = await cloudinary.uploader.upload(story.mediaUrl, {
      public_id: storyUniqueName,
      resource_type: story.mediaType === "video" ? "video" : "image",
    });

    const highlight = new Highlight({
      author: userId,
      title: title.trim(),
      coverImage,
      coverImagePublicId,
      stories: [
        {
          mediaType: story.mediaType,
          mediaUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        },
      ],
    });

    await highlight.save();

    await User.findByIdAndUpdate(userId, {
      $push: { highlights: highlight._id },
    });

    return res.status(201).json({
      message: "Highlight created successfully",
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (cloudinaryErr) {
        console.error(
          "Failed to delete unused highlight cover from Cloudinary:",
          cloudinaryErr,
        );
      }
    }

    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const getInfoOfOneHighlight = async (req, res) => {
  try {
    const { highlightId } = req.params;
    const myId = req.userId;

    if (!highlightId || !mongoose.Types.ObjectId.isValid(highlightId)) {
      return res.status(400).json({ message: "Invalid Highlight ID" });
    }

    const highlight = await Highlight.findById(highlightId);
    if (!highlight) {
      return res.status(404).json({ message: "Highlight not found" });
    }

    const authorId = highlight.author;

    if (authorId.toString() !== myId.toString()) {
      const [authorUser, me] = await Promise.all([
        User.findById(authorId).select("isPrivate followers blockedUsers"),
        User.findById(myId).select("blockedUsers"),
      ]);

      if (!authorUser) {
        return res.status(404).json({ message: "Highlight author not found" });
      }

      const isBlocked =
        authorUser.blockedUsers.some((id) => id.toString() === myId.toString()) ||
        me.blockedUsers.some((id) => id.toString() === authorId.toString());

      if (isBlocked) {
        return res.status(403).json({
          message: "Access denied: You are blocked by this user or have blocked this user.",
        });
      }

      const isFollower = authorUser.followers.some(
        (id) => id.toString() === myId.toString()
      );

      if (authorUser.isPrivate && !isFollower) {
        return res.status(403).json({ message: "Private Account" });
      }
    }

    const populatedHighlight = await Highlight.findById(highlightId)
      .select("-coverImagePublicId -stories.publicId")
      .populate("author", "username profilePicture name");

    return res.status(200).json({ highlight: populatedHighlight });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const updateHighlightCover = async (req, res) => {
  let uploadedPublicId = null;
  try {
    const { highlightId } = req.params;
    const userId = req.userId;

    if (!highlightId || !mongoose.Types.ObjectId.isValid(highlightId)) {
      return res.status(400).json({ message: "Invalid Highlight ID" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Cover image is required" });
    }

    const highlight = await Highlight.findById(highlightId);
    if (!highlight) {
      return res.status(404).json({ message: "Highlight not found" });
    }

    if (highlight.author.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You are not authorized to modify this highlight",
      });
    }

    const originalName = path.parse(req.file.originalname).name;
    const cleanName = originalName.replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
    const uniqueName = `highlight_cover_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}_${cleanName}`;

    const result = await uploadToCloudinary(req.file.buffer, uniqueName);
    uploadedPublicId = result.public_id;

    // Remove the old cover image
    if (highlight.coverImagePublicId) {
      try {
        await cloudinary.uploader.destroy(highlight.coverImagePublicId);
      } catch (err) {
        console.error("Failed to delete old highlight cover:", err.message);
      }
    }

    highlight.coverImage = result.secure_url;
    highlight.coverImagePublicId = result.public_id;
    await highlight.save();

    return res.status(200).json({
      message: "Highlight cover updated successfully",
      coverImage: result.secure_url,
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (err) {
        console.error("Failed to rollback cloudinary upload:", err.message);
      }
    }
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const removeHighlightCover = async (req, res) => {
  try {
    const { highlightId } = req.params;
    const userId = req.userId;

    if (!highlightId || !mongoose.Types.ObjectId.isValid(highlightId)) {
      return res.status(400).json({ message: "Invalid Highlight ID" });
    }

    const highlight = await Highlight.findById(highlightId);
    if (!highlight) {
      return res.status(404).json({ message: "Highlight not found" });
    }

    if (highlight.author.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You are not authorized" });
    }

    // Delete from cloudinary
    if (highlight.coverImagePublicId) {
      try {
        await cloudinary.uploader.destroy(highlight.coverImagePublicId);
      } catch (err) {
        console.error("Failed to delete old highlight cover:", err.message);
      }
    }

    highlight.coverImage = undefined;
    highlight.coverImagePublicId = undefined;
    await highlight.save();

    return res.status(200).json({
      message: "Highlight cover removed successfully",
    });
  } catch (error) {
    console.error("Error in removeHighlightCover:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export {
  deleteHighlight,
  deleteStoryFromHighlight,
  renameHighlight,
  addStoryToHighlight,
  createHighlightFromStory,
  getInfoOfOneHighlight,
  updateHighlightCover,
  removeHighlightCover,
};
