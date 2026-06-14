import Story from "../models/story.model.js";
import User from "../models/user.model.js";
import { uploadToCloudinary, cloudinary } from "../config/cloudinary.js";
import path from "path";

const addStory = async (req, res) => {
  let uploadedPublicId = null;

  try {
    const userId = req.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Media is required" });
    }

    const originalName = path.parse(req.file.originalname).name;

    const cleanName = originalName.replace(/\s+/g, "_").replace(/[^\w\-]/g, "");

    const uniqueName = `${user.username}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}_${cleanName}`;

    const result = await uploadToCloudinary(req.file.buffer, uniqueName);

    uploadedPublicId = result.public_id;

    const story = await Story.create({
      author: userId,
      mediaUrl: result.secure_url,
      mediaPublicId: result.public_id,
      mediaType: result.resource_type === "video" ? "video" : "image",
    });

    await User.findByIdAndUpdate(userId, { $push: { stories: story._id } });

    const responseStory = story.toObject();
    delete responseStory.mediaPublicId;

    return res.status(201).json({
      message: "Story created successfully",
      story: responseStory,
    });
  } catch (error) {
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (err) {
        console.log(err);
      }
    }

    return res.status(500).json({
      message: error.message,
    });
  }
};

const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.userId;

    const story = await Story.findById(storyId);

    if (!story) {
      return res.status(404).json({
        message: "Story not found",
      });
    }

    if (story.author.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "You are not authorized to delete this story",
      });
    }

    try {
      await cloudinary.uploader.destroy(story.mediaPublicId, {
        resource_type: story.mediaType === "video" ? "video" : "image",
      });
    } catch (cloudinaryErr) {
      console.error(
        "Failed to delete story media from Cloudinary:",
        cloudinaryErr,
      );
    }

    await story.deleteOne();

    await User.findByIdAndUpdate(story.author, {
      $pull: { stories: story._id },
    });

    return res.status(200).json({
      message: "Story deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

const getOneStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const myId = req.userId;

    const currentStory = await Story.findById(storyId)
      .select("-mediaPublicId")
      .populate("author", "name username profilePicture")
      .populate("viewedBy", "username profilePicture");
    if (!currentStory) {
      return res.status(404).json({ message: "Story not found" });
    }

    const targetUserId = currentStory.author._id.toString();
    const isSelf = targetUserId === myId.toString();

    if (!isSelf) {
      const [target, me] = await Promise.all([
        User.findById(targetUserId).select("isPrivate followers blockedUsers"),
        User.findById(myId).select("blockedUsers"),
      ]);

      if (!target) {
        return res.status(404).json({ message: "Story author not found" });
      }

      if (!me) {
        return res.status(404).json({ message: "User not found" });
      }

      const isBlocked =
        target.blockedUsers.some((id) => id.toString() === myId.toString()) ||
        me.blockedUsers.some((id) => id.toString() === targetUserId);

      if (isBlocked) {
        return res.status(403).json({
          message: "You are blocked by the user or you have blocked the user",
        });
      }

      const isFollower = target.followers.some(
        (id) => id.toString() === myId.toString(),
      );

      if (target.isPrivate && !isFollower) {
        return res.status(403).json({ message: "Private Account" });
      }
    }

    if (currentStory.deleteAt < new Date()) {
      return res.status(404).json({ message: "Story expired" });
    }

    const alreadyViewed = currentStory.viewedBy.some(
      (v) => v._id.toString() === myId.toString(),
    );
    if (!alreadyViewed) {
      currentStory.viewedBy.push(myId);
      await currentStory.save();
    }

    const updatedStory = await Story.findById(storyId)
      .select("-mediaPublicId")
      .populate("author", "name username profilePicture")
      .populate("viewedBy", "username profilePicture");

    return res.status(200).json({ story: updatedStory });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAllStories = async (req, res) => {
  try {
    const myId = req.userId;
    const { targetUserId } = req.params;

    const isSelf = targetUserId.toString() === myId.toString();

    const owner = await User.findById(targetUserId).select(
      "username profilePicture name isPrivate followers blockedUsers",
    );
    if (!owner) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!isSelf) {
      const me = await User.findById(myId).select("blockedUsers");
      if (!me) {
        return res.status(404).json({ message: "User not found" });
      }

      const isBlocked =
        owner.blockedUsers.some((id) => id.toString() === myId.toString()) ||
        me.blockedUsers.some((id) => id.toString() === owner._id.toString());

      if (isBlocked) {
        return res.status(403).json({
          message: "You are blocked by the user or you have blocked the user",
        });
      }

      const isFollower = owner.followers.some(
        (id) => id.toString() === myId.toString(),
      );

      if (owner.isPrivate && !isFollower) {
        return res.status(403).json({ message: "Private Account" });
      }
    }

    const stories = await Story.find({
      author: owner._id,
      deleteAt: { $gt: new Date() },
    })
      .select("-mediaPublicId")
      .populate("author", "name username profilePicture")
      .populate("viewedBy", "username profilePicture")
      .sort({ createdAt: 1 });
    return res.status(200).json({ stories });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export { addStory, deleteStory, getOneStory, getAllStories };
