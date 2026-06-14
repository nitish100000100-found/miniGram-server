import mongoose from "mongoose";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import Story from "../models/story.model.js";
import { uploadToCloudinary, cloudinary } from "../config/cloudinary.js";
import path from "path";


const uploadPost = async (req, res) => {
  let uploadedPublicId = null;
  let session = null;

  try {
    const { caption } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Upload a photo or video",
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    const originalName = path.parse(req.file.originalname).name;

    const cleanName = originalName.replace(/\s+/g, "_").replace(/[^\w\-]/g, "");

    const uniqueName = `${user.username}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}_${cleanName}`;

    const result = await uploadToCloudinary(req.file.buffer, uniqueName);

    uploadedPublicId = result.public_id;

    const mediaType = result.resource_type === "video" ? "video" : "image";

    session = await mongoose.startSession();
    session.startTransaction();

    const post = new Post({
      author: userId,
      caption,
      mediaUrl: result.secure_url,
      mediaType,
      mediaPublicId: result.public_id,
    });

    await post.save({ session });

    await User.findByIdAndUpdate(
      userId,
      {
        $push: { posts: post._id },
      },
      { session },
    );

    await session.commitTransaction();

    const responsePost = post.toObject();
    delete responsePost.mediaPublicId;

    return res.status(201).json({
      message: "Post created successfully",
      post: responsePost,
    });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId);
      } catch (deleteError) {
        console.error("Failed to delete media:", deleteError.message);
      }
    }

    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};



const deletePost = async (req, res) => {
  let session = null;
  try {
    const { postId } = req.params;
    const userId = req.userId;

    if (!postId) {
      return res.status(400).json({ message: "Post ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid Post ID" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.author.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this post" });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    await User.findByIdAndUpdate(
      userId,
      { $pull: { posts: postId } },
      { session },
    );

    await User.updateMany(
      { $or: [{ likedPosts: postId }, { savedPosts: postId }] },
      { $pull: { likedPosts: postId, savedPosts: postId } },
      { session },
    );

    await Post.findByIdAndDelete(postId).session(session);

    await session.commitTransaction();
    if (post.mediaPublicId) {
      try {
        await cloudinary.uploader.destroy(post.mediaPublicId);
      } catch (cloudinaryErr) {
        console.error(
          "Failed to delete media from Cloudinary:",
          cloudinaryErr.message,
        );
      }
    }

    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};



const savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    if (!postId) {
      return res.status(400).json({ message: "Post ID is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const postAuthor = await User.findById(post.author);
    if (!postAuthor) {
      return res.status(404).json({ message: "Post author not found" });
    }

    const me = await User.findById(userId);
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    // Blocking / Private account checks (except if it is user's own post)
    const isSelf = post.author.toString() === userId.toString();
    if (!isSelf) {
      const isBlocked =
        postAuthor.blockedUsers.some(
          (id) => id.toString() === userId.toString(),
        ) ||
        me.blockedUsers.some(
          (id) => id.toString() === postAuthor._id.toString(),
        );

      if (isBlocked) {
        return res.status(403).json({
          message: "You are blocked by the user or you have blocked the user",
        });
      }

      const isPrivate = postAuthor.isPrivate;
      const isFollowed = postAuthor.followers.some(
        (id) => id.toString() === userId.toString(),
      );

      if (isPrivate && !isFollowed) {
        return res.status(403).json({ message: "Private Account" });
      }
    }

    const alreadySaved = me.savedPosts.some(
      (id) => id.toString() === postId.toString(),
    );

    if (alreadySaved) {
      await User.updateOne({ _id: userId }, { $pull: { savedPosts: postId } });
    } else {
      await User.updateOne(
        { _id: userId },
        { $addToSet: { savedPosts: postId } },
      );
    }

    return res.status(200).json({
      message: alreadySaved
        ? "Post unsaved successfully"
        : "Post saved successfully",
      saved: !alreadySaved,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const getFeedPosts = async (req, res) => {
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

    const allowedFollowed = me.following.filter(
      (id) => !excludedUsers.some((excludedId) => excludedId.toString() === id.toString())
    );
    const authorIds = [...allowedFollowed, userId];

    const posts = await Post.find({ author: { $in: authorIds } })
      .select("-mediaPublicId")
      .populate({
        path: "author",
        select: "username profilePicture name isPrivate stories",
        populate: {
          path: "stories",
          match: { deleteAt: { $gt: new Date() } },
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({ posts });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const getExplorePosts = async (req, res) => {
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
      _id: { $nin: [...excludedUsers, userId] },
      $or: [
        { isPrivate: false },
        { _id: { $in: me.following } },
      ],
    }).select("_id");

    const authorIds = validAuthors.map((u) => u._id);

    const posts = await Post.find({ author: { $in: authorIds } })
      .select("-mediaPublicId")
      .populate({
        path: "author",
        select: "username profilePicture name isPrivate stories",
        populate: {
          path: "stories",
          match: { deleteAt: { $gt: new Date() } },
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      posts,
      currentUser: {
        _id: me._id,
        username: me.username,
        likedPosts: me.likedPosts,
        savedPosts: me.savedPosts,
        following: me.following,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};
const getSavedPosts = async (req, res) => {
  try {

    //This whole query was written by AI
    const userId = req.userId.toString();
    const me = await User.findById(userId).populate({
      path: "savedPosts",
      populate: [
        {
          path: "author",
          select: "username profilePicture name isPrivate followers blockedUsers stories",
          populate: {
            path: "stories",
            match: { deleteAt: { $gt: new Date() } },
          },
        },
        {
          path: "comments.commentedBy",
          select: "username profilePicture name",
        },
      ],
      options: { sort: { createdAt: -1 } },
    });
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const canViewPost = (post) => {
      if (!post) return false;        
      if (!post.author) return false; 
      const author = post.author;
      const authorId = author._id.toString();
     
      if (authorId === userId) return true;
      const isBlocked =
        author.blockedUsers?.some((id) => id.toString() === userId) ||
        me.blockedUsers?.some((id) => id.toString() === authorId);
      if (isBlocked) return false;
      if (author.isPrivate) {
        const iFollow = author.followers?.some(
          (id) => id.toString() === userId,
        );
        if (!iFollow) return false;
      }
      return true;
    };
    const visiblePosts = me.savedPosts
      .filter(canViewPost)
      .map((post) => {
        const p = post.toObject();
       
        delete p.mediaPublicId;
        if (p.author) {
          delete p.author.blockedUsers;
          delete p.author.followers;
          delete p.author.isPrivate;
          delete p.author.email;
        }
        return p;
      });
    return res.status(200).json({ savedPosts: visiblePosts });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

// visiblePosts = [
//   {
//     _id: "665f1a2b3c4d5e6f7a8b9c01",
//     author: {
//       _id: "665f1a2b3c4d5e6f7a8b9c10",
//       username: "rohan_99",
//       name: "Rohan Kumar",
//       profilePicture: "https://res.cloudinary.com/demo/image/upload/rohan.jpg"
//       // isPrivate, followers, blockedUsers REMOVED ✅
//     },
//     mediaType: "image",
//     mediaUrl: "https://res.cloudinary.com/demo/image/upload/post1.jpg",
//     mediaPublicId: "post1",
//     caption: "Sunset vibes 🌅",
//     likes: ["665f1a2b3c4d5e6f7a8b9c20", "665f1a2b3c4d5e6f7a8b9c21"],
//     comments: [
//       {
//         _id: "665f1a2b3c4d5e6f7a8b9c30",
//         text: "Nice pic bro!",
//         createdAt: "2025-06-01T10:00:00.000Z",
//         commentedBy: {
//           _id: "665f1a2b3c4d5e6f7a8b9c20",
//           username: "neha_k",
//           name: "Neha Kapoor",
//           profilePicture: "https://res.cloudinary.com/demo/image/upload/neha.jpg"
//         }
//       }
//     ],
//     createdAt: "2025-06-01T09:00:00.000Z",
//     updatedAt: "2025-06-01T09:30:00.000Z"
//   },
//   {
//     _id: "665f1a2b3c4d5e6f7a8b9c02",
//     author: {
//       _id: "665f1a2b3c4d5e6f7a8b9c99",
//       username: "eren_dev",
//       name: "Eren",
//       profilePicture: "https://res.cloudinary.com/demo/image/upload/eren.jpg"
//     },
//     mediaType: "video",
//     mediaUrl: "https://res.cloudinary.com/demo/video/upload/myvideo.mp4",
//     mediaPublicId: "myvideo",
//     caption: "My own post",
//     likes: [],
//     comments: [],
//     createdAt: "2025-05-28T14:20:00.000Z",
//     updatedAt: "2025-05-28T14:20:00.000Z"
//   }
// ]

const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid Post ID" });
    }

    const post = await Post.findById(postId)
      .select("-mediaPublicId")
      .populate({
        path: "author",
        select: "username profilePicture name blockedUsers isPrivate followers stories",
        populate: {
          path: "stories",
          match: { deleteAt: { $gt: new Date() } },
        },
      })
      .populate({
        path: "comments.commentedBy",
        select: "username profilePicture name blockedUsers isPrivate stories",
        populate: {
          path: "stories",
          match: { deleteAt: { $gt: new Date() } },
        },
      });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const postAuthor = post.author;
    if (!postAuthor) {
      return res.status(404).json({ message: "Post author not found" });
    }

    const me = await User.findById(userId).select("blockedUsers");
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const myId = me._id.toString();
    const isSelf = postAuthor._id.toString() === myId;

    if (!isSelf) {
      const blockedByEachOther =
        postAuthor.blockedUsers?.some((id) => id.toString() === myId) ||
        me.blockedUsers?.some((id) => id.toString() === postAuthor._id.toString());

      if (blockedByEachOther) {
        return res.status(403).json({
          message: "You are blocked by this user or you have blocked this user",
        });
      }

      if (postAuthor.isPrivate) {
        const isFollowed = postAuthor.followers?.some((id) => id.toString() === myId);
        if (!isFollowed) {
          return res.status(403).json({ message: "Private Account" });
        }
      }
    }

    const safePost = post.toObject();

    safePost.comments = (safePost.comments || [])
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
        }
        return c;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    delete safePost.author?.blockedUsers;
    delete safePost.author?.followers;

    const currentUser = await User.findById(userId).select(
      "username profilePicture name stories likedPosts savedPosts following"
    );

    return res.status(200).json({ post: safePost, currentUser });
  } catch (error) {
    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  }
};

export {
  uploadPost,
  deletePost,
  savePost,
  getFeedPosts,
  getExplorePosts,
  getSavedPosts,
  getPostComments,
};
