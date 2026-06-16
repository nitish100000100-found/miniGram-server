import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Loop from "../models/loop.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { uploadToCloudinary, cloudinary } from "../config/cloudinary.js";
import path from "path";

const uploadLoop = async (req, res) => {
  let uploadedPublicId = null;
  let session = null;

  try {
    const { caption } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Upload a video file" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const originalName = path.parse(req.file.originalname).name;
    const cleanName = originalName.replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
    const uniqueName = `${user.username}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}_${cleanName}`;

    const result = await uploadToCloudinary(req.file.buffer, uniqueName);
    uploadedPublicId = result.public_id;

    let thumbnail = "";
    if (result.resource_type === "video") {
      thumbnail = result.secure_url.replace(/\.[^/.]+$/, ".jpg");
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const loop = new Loop({
      author: userId,
      mediaUrl: result.secure_url,
      public_id: result.public_id,
      thumbnail: thumbnail,
      caption: caption || "",
    });

    await loop.save({ session });

    await User.findByIdAndUpdate(
      userId,
      { $push: { loops: loop._id } },
      { session },
    );

    await session.commitTransaction();

    const responseLoop = loop.toObject();
    delete responseLoop.public_id;

    return res.status(201).json({
      message: "Loop uploaded successfully",
      loop: responseLoop,
    });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId, {
          resource_type: "video",
        });
      } catch (deleteError) {
        console.error(
          "Failed to delete video from Cloudinary:",
          deleteError.message,
        );
      }
    }

    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

const deleteLoop = async (req, res) => {
  let session = null;
  try {
    const { loopId } = req.params;
    const userId = req.userId;
    const loop = req.loop;

    session = await mongoose.startSession();
    session.startTransaction();

    await User.findByIdAndUpdate(
      userId,
      { $pull: { loops: loopId } },
      { session },
    );

    await Notification.deleteMany({ targetType: "Loop", targetId: loopId }).session(session);

    await Loop.findByIdAndDelete(loopId).session(session);

    await session.commitTransaction();

    const publicId = loop?.public_id;

    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: "video",
        });
      } catch (err) {
        console.error("Failed to delete video from Cloudinary:", err.message);
      }
    }

    return res.status(200).json({ message: "Loop deleted successfully" });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};



const likeLoop = async (req, res) => {
  try {
    const { loopId } = req.params;
    const userId = req.userId;

    if (!loopId) {
      return res.status(400).json({ message: "Loop ID is required" });
    }

    const loop = await Loop.findById(loopId);
    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    const loopAuthor = await User.findById(loop.author);
    if (!loopAuthor) {
      return res.status(404).json({ message: "Loop author not found" });
    }

    const me = await User.findById(userId);
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const isSelf = loop.author.toString() === userId.toString();

    if (!isSelf) {
      const isBlocked =
        loopAuthor.blockedUsers.some(
          (id) => id.toString() === userId.toString(),
        ) ||
        me.blockedUsers.some(
          (id) => id.toString() === loopAuthor._id.toString(),
        );

      if (isBlocked) {
        return res.status(403).json({
          message: "You are blocked by the user or you have blocked the user",
        });
      }

      const isPrivate = loopAuthor.isPrivate;
      const isFollowed = loopAuthor.followers.some(
        (id) => id.toString() === userId.toString(),
      );

      if (isPrivate && !isFollowed) {
        return res.status(403).json({ message: "Private Account" });
      }
    }

    const alreadyLiked = loop.likes.some(
      (id) => id.toString() === userId.toString(),
    );

    if (alreadyLiked) {
      loop.likes = loop.likes.filter(
        (id) => id.toString() !== userId.toString(),
      );

      // Delete loop like notification
      await Notification.deleteOne({
        sender: userId,
        recipient: loop.author,
        type: "like",
        targetType: "Loop",
        targetId: loopId,
      });
    } else {
      loop.likes.push(userId);

      // Create notification if not self
      if (userId.toString() !== loop.author.toString()) {
        await Notification.create({
          sender: userId,
          recipient: loop.author,
          type: "like",
          targetType: "Loop",
          targetId: loopId,
        });
      }
    }

    await loop.save();

    return res.status(200).json({
      message: alreadyLiked
        ? "Loop unliked successfully"
        : "Loop liked successfully",
      liked: !alreadyLiked,
      likesCount: loop.likes.length,
    });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const commentLoop = async (req, res) => {
  try {
    const { loopId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    if (!loopId) {
      return res.status(400).json({ message: "Loop ID is required" });
    }

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const loop = await Loop.findById(loopId);
    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    const loopAuthor = await User.findById(loop.author);
    if (!loopAuthor) {
      return res.status(404).json({ message: "Loop author not found" });
    }

    const me = await User.findById(userId);
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const isSelf = loop.author.toString() === userId.toString();
    if (!isSelf) {
      const isBlocked =
        loopAuthor.blockedUsers.some(
          (id) => id.toString() === userId.toString(),
        ) ||
        me.blockedUsers.some(
          (id) => id.toString() === loopAuthor._id.toString(),
        );

      if (isBlocked) {
        return res.status(403).json({
          message: "You are blocked by the user or you have blocked the user",
        });
      }

      const isPrivate = loopAuthor.isPrivate;
      const isFollowed = loopAuthor.followers.some(
        (id) => id.toString() === userId.toString(),
      );

      if (isPrivate && !isFollowed) {
        return res.status(403).json({ message: "Private Account" });
      }
    }

    loop.comments.push({ commentedBy: userId, text: text.trim() });
    await loop.save();

    // Create notification if not self
    if (userId.toString() !== loop.author.toString()) {
      await Notification.create({
        sender: userId,
        recipient: loop.author,
        type: "comment",
        targetType: "Loop",
        targetId: loopId,
      });
    }

    const populatedLoop = await Loop.findById(loopId).populate(
      "comments.commentedBy",
      "username profilePicture name",
    );

    return res.status(201).json({
      message: "Comment added successfully",
      comments: populatedLoop.comments,
    });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const deleteCommentLoop = async (req, res) => {
  try {
    const { loopId, commentId } = req.params;
    const userId = req.userId;

    if (!loopId || !commentId) {
      return res
        .status(400)
        .json({ message: "Loop ID and Comment ID are required" });
    }

    const loop = await Loop.findById(loopId);
    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    const commentIndex = loop.comments.findIndex(
      (c) => c._id.toString() === commentId.toString(),
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const targetComment = loop.comments[commentIndex];

    const isLoopAuthor = loop.author.toString() === userId.toString();
    const isCommentCreator =
      targetComment.commentedBy.toString() === userId.toString();

    if (!isLoopAuthor && !isCommentCreator) {
      return res.status(403).json({
        message: "You are not authorized to delete this comment",
      });
    }

    loop.comments = loop.comments.filter(
      (comment) => comment._id.toString() !== commentId.toString(),
    );
    await loop.save();

    // Delete comment notification
    await Notification.deleteOne({
      sender: targetComment.commentedBy,
      recipient: loop.author,
      type: "comment",
      targetType: "Loop",
      targetId: loopId,
    });

    const populatedLoop = await Loop.findById(loopId).populate(
      "comments.commentedBy",
      "username profilePicture name",
    );

    return res.status(200).json({
      message: "Comment deleted successfully",
      comments: populatedLoop.comments,
    });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const getLoops = async (req, res) => {
  try {
    const userId = req.userId;

    const me = await User.findById(userId);
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const blockedBy = (
      await User.find({ blockedUsers: userId }).select("_id")
    ).map((u) => u._id);

    const excludedUsers = [...me.blockedUsers, ...blockedBy];

    const validAuthors = await User.find({
      _id: { $nin: excludedUsers },
      $or: [
        { isPrivate: false },
        { _id: { $in: me.following } },
        { _id: userId },
      ],
    }).select("_id");

    const authorIds = validAuthors.map((u) => u._id);

    const loops = await Loop.find({ author: { $in: authorIds } })
      .select("-public_id")
      .populate("author", "username profilePicture name")
      .populate("comments.commentedBy", "username profilePicture name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ loops });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const getLoopById = async (req, res) => {
  try {
    const { loopId } = req.params;
    const userId = req.userId;

    if (!loopId) {
      return res.status(400).json({ message: "Loop ID is required" });
    }

    const loop = await Loop.findById(loopId)
      .select("-public_id")
      .populate(
        "author",
        "username profilePicture name isPrivate followers blockedUsers",
      )
      .populate("comments.commentedBy", "username profilePicture name");

    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    const loopAuthor = loop.author;

    const me = await User.findById(userId);
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const isSelf = loopAuthor._id.toString() === userId.toString();

    if (!isSelf) {
      const isBlocked =
        loopAuthor.blockedUsers.some(
          (id) => id.toString() === userId.toString(),
        ) ||
        me.blockedUsers.some(
          (id) => id.toString() === loopAuthor._id.toString(),
        );

      if (isBlocked) {
        return res.status(403).json({
          message: "You are blocked by the user or you have blocked the user",
        });
      }

      const isPrivate = loopAuthor.isPrivate;
      const isFollowed = loopAuthor.followers.some(
        (id) => id.toString() === userId.toString(),
      );

      if (isPrivate && !isFollowed) {
        return res.status(403).json({ message: "Private Account" });
      }
    }

    const safeLoop = loop.toObject();
    delete safeLoop.author.blockedUsers;
    delete safeLoop.author.followers;
    delete safeLoop.author.isPrivate;
    delete safeLoop.author.email;
    return res.status(200).json({ loop: safeLoop });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const getUserLoops = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const me = await User.findById(userId);
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const isSelf = targetUser._id.toString() === userId.toString();

    if (!isSelf) {
      const isBlocked =
        targetUser.blockedUsers.some(
          (id) => id.toString() === userId.toString(),
        ) ||
        me.blockedUsers.some(
          (id) => id.toString() === targetUser._id.toString(),
        );

      if (isBlocked) {
        return res.status(403).json({
          message: "You are blocked by the user or you have blocked the user",
        });
      }

      const isPrivate = targetUser.isPrivate;
      const isFollowed = targetUser.followers.some(
        (id) => id.toString() === userId.toString(),
      );

      if (isPrivate && !isFollowed) {
        return res.status(403).json({ message: "Private Account" });
      }
    }

    const loops = await Loop.find({ author: targetUserId })
      .select("_id thumbnail views likes createdAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({ loops });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

const getWhoLikedLoop = async (req, res) => {
  try {
    const { loopId } = req.params;
    const userId = req.userId;

    if (!loopId || !mongoose.Types.ObjectId.isValid(loopId)) {
      return res.status(400).json({ message: "Invalid Loop ID" });
    }

    const loop = await Loop.findById(loopId);
    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    const loopAuthor = await User.findById(loop.author);
    if (!loopAuthor) {
      return res.status(404).json({ message: "Loop author not found" });
    }

    const me = await User.findById(userId);
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const isSelf = loop.author.toString() === userId.toString();
    if (!isSelf) {
      const isBlocked =
        loopAuthor.blockedUsers.some(
          (id) => id.toString() === userId.toString(),
        ) ||
        me.blockedUsers.some(
          (id) => id.toString() === loopAuthor._id.toString(),
        );

      if (isBlocked) {
        return res.status(403).json({
          message: "You are blocked by the user or you have blocked the user",
        });
      }

      const isPrivate = loopAuthor.isPrivate;
      const isFollowed = loopAuthor.followers.some(
        (id) => id.toString() === userId.toString(),
      );

      if (isPrivate && !isFollowed) {
        return res.status(403).json({ message: "Private Account" });
      }
    }

    const usersWhoLiked = await User.find({
      _id: { $in: loop.likes },
    })
      .select("_id username name profilePicture blockedUsers isPrivate");

    const filteredUsers = usersWhoLiked
      .filter((u) => {
        if (!u || !u._id) return false;
        const isBlocked =
          me.blockedUsers.some((id) => id.toString() === u._id.toString()) ||
          u.blockedUsers?.some((id) => id.toString() === userId.toString());
        return !isBlocked;
      })
      .map((u) => ({
        _id: u._id,
        username: u.username,
        name: u.name,
        profilePicture: u.profilePicture,
        isPrivate: u.isPrivate,
      }));

    return res.status(200).json({ users: filteredUsers });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const getLoopComments = async (req, res) => {
  try {
    const { loopId } = req.params;
    const userId = req.userId;

    if (!loopId || !mongoose.Types.ObjectId.isValid(loopId)) {
      return res.status(400).json({ message: "Invalid Loop ID" });
    }

    const loop = await Loop.findById(loopId)
      .select("-public_id")
      .populate(
        "author",
        "username profilePicture name blockedUsers isPrivate followers",
      )
      .populate(
        "comments.commentedBy",
        "username profilePicture name blockedUsers isPrivate",
      );

    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    const loopAuthor = loop.author;
    if (!loopAuthor) {
      return res.status(404).json({ message: "Loop author not found" });
    }

    const me = await User.findById(userId).select("blockedUsers");
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const myId = me._id.toString();
    const isSelf = loopAuthor._id.toString() === myId;

    if (!isSelf) {
      const blockedByEachOther =
        loopAuthor.blockedUsers?.some((id) => id.toString() === myId) ||
        me.blockedUsers?.some((id) => id.toString() === loopAuthor._id.toString());

      if (blockedByEachOther) {
        return res.status(403).json({
          message: "You are blocked by this user or you have blocked this user",
        });
      }

      if (loopAuthor.isPrivate) {
        const isFollowed = loopAuthor.followers?.some((id) => id.toString() === myId);
        if (!isFollowed) {
          return res.status(403).json({ message: "Private Account" });
        }
      }
    }

    const safeLoop = loop.toObject();

    safeLoop.comments = (safeLoop.comments || [])
      .filter((c) => {
        const commenter = c.commentedBy;
        if (!commenter) return false;

        const commenterBlockedMe = commenter.blockedUsers?.some((id) => id.toString() === myId);
        const iBlockedCommenter = me.blockedUsers?.some(
          (id) => id.toString() === commenter._id.toString()
        );

        return !commenterBlockedMe && !iBlockedCommenter;
      })
      .map((c) => {
        if (c.commentedBy) {
          delete c.commentedBy.blockedUsers;
          delete c.commentedBy.email;
        }
        return c;
      });

    return res.status(200).json({ comments: safeLoop.comments });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

export {
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
};
