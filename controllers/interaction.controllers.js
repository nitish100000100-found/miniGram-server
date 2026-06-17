import mongoose from "mongoose";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import Story from "../models/story.model.js";
import Loop from "../models/loop.model.js";
import Notification from "../models/notification.model.js";

const unblockUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target User ID is required" });
    }

    const me = await User.findById(userId);
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const isBlocked = me.blockedUsers.some(
      (id) => id.toString() === targetUserId.toString(),
    );

    if (!isBlocked) {
      return res.status(400).json({ message: "User is not blocked" });
    }

    me.blockedUsers = me.blockedUsers.filter(
      (id) => id.toString() !== targetUserId.toString(),
    );
    await me.save();

    return res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const blockUser = async (req, res) => {
  let session = null;
  try {
    const targetUserId = req.params.id;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target User ID is required" });
    }

    if (targetUserId.toString() === userId.toString()) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const me = await User.findById(userId).session(session);
    const target = await User.findById(targetUserId).session(session);

    if (!me || !target) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }

    const alreadyBlocked = me.blockedUsers.some(
      (id) => id.toString() === targetUserId.toString(),
    );
    if (alreadyBlocked) {
      await session.abortTransaction();
      return res.status(400).json({ message: "User is already blocked" });
    }

    const blockedByTarget = target.blockedUsers.some(
      (id) => id.toString() === userId.toString(),
    );
    if (blockedByTarget) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Action not allowed" });
    }

    me.blockedUsers.push(targetUserId);

    // ---- follow / request cleanup ----
    me.followers = (me.followers || []).filter(
      (id) => id.toString() !== targetUserId.toString(),
    );
    me.following = (me.following || []).filter(
      (id) => id.toString() !== targetUserId.toString(),
    );
    target.followers = (target.followers || []).filter(
      (id) => id.toString() !== userId.toString(),
    );
    target.following = (target.following || []).filter(
      (id) => id.toString() !== userId.toString(),
    );

    me.sendRequest = (me.sendRequest || []).filter(
      (id) => id.toString() !== targetUserId.toString(),
    );
    me.receivedRequest = (me.receivedRequest || []).filter(
      (id) => id.toString() !== targetUserId.toString(),
    );
    target.sendRequest = (target.sendRequest || []).filter(
      (id) => id.toString() !== userId.toString(),
    );
    target.receivedRequest = (target.receivedRequest || []).filter(
      (id) => id.toString() !== userId.toString(),
    );

    // ---- cross-content cleanup (likes, comments, savedPosts, likedPosts) ----

    await Post.updateMany(
      { author: userId },
      {
        $pull: { likes: targetUserId, comments: { commentedBy: targetUserId } },
      },
      { session },
    );
    await Loop.updateMany(
      { author: userId },
      {
        $pull: { likes: targetUserId, comments: { commentedBy: targetUserId } },
      },
      { session },
    );

    await Post.updateMany(
      { author: targetUserId },
      { $pull: { likes: userId, comments: { commentedBy: userId } } },
      { session },
    );
    await Loop.updateMany(
      { author: targetUserId },
      { $pull: { likes: userId, comments: { commentedBy: userId } } },
      { session },
    );

    const targetPostIds = (target.posts || []).map((id) => id.toString());
    const myPostIds = (me.posts || []).map((id) => id.toString());

    me.likedPosts = (me.likedPosts || []).filter(
      (id) => !targetPostIds.includes(id.toString()),
    );
    me.savedPosts = (me.savedPosts || []).filter(
      (id) => !targetPostIds.includes(id.toString()),
    );

    target.likedPosts = (target.likedPosts || []).filter(
      (id) => !myPostIds.includes(id.toString()),
    );
    target.savedPosts = (target.savedPosts || []).filter(
      (id) => !myPostIds.includes(id.toString()),
    );

    // Delete all notifications between me and targetUserId
    await Notification.deleteMany({
      $or: [
        { sender: userId, recipient: targetUserId },
        { sender: targetUserId, recipient: userId },
      ],
    }).session(session);

    await me.save({ session });
    await target.save({ session });

    await session.commitTransaction();

    return res.status(200).json({ message: "User blocked successfully" });
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

const comment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.userId;

    if (!postId) {
      return res.status(400).json({ message: "Post ID is required" });
    }

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Comment text is required" });
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

    const newCommentObj = { commentedBy: userId, text: text.trim() };
    post.comments.push(newCommentObj);
    await post.save();

    // Create notification if not self
    if (userId.toString() !== post.author.toString()) {
      await Notification.create({
        sender: userId,
        recipient: post.author,
        type: "comment",
        targetType: "Post",
        targetId: postId,
      });
    }

    const addedCommentId = post.comments[post.comments.length - 1]._id;

    return res.status(201).json({
      message: "Comment added successfully",
      commentId: addedCommentId,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.userId;

    if (!postId || !commentId) {
      return res
        .status(400)
        .json({ message: "Post ID and Comment ID are required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const commentIndex = post.comments.findIndex(
      (c) => c._id.toString() === commentId.toString(),
    );

    if (commentIndex === -1) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const targetComment = post.comments[commentIndex];

    const isPostAuthor = post.author.toString() === userId.toString();
    const isCommentCreator =
      targetComment.commentedBy.toString() === userId.toString();

    if (!isPostAuthor && !isCommentCreator) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this comment" });
    }

    post.comments = post.comments.filter(
      (comment) => comment._id.toString() !== commentId.toString(),
    );
    await post.save();

    // Delete comment notification
    await Notification.deleteOne({
      sender: targetComment.commentedBy,
      recipient: post.author,
      type: "comment",
      targetType: "Post",
      targetId: postId,
    });

    return res.status(200).json({
      message: "Comment deleted successfully",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const likePost = async (req, res) => {
  let session;

  try {
    const { postId } = req.params;
    const userId = req.userId;

    session = await mongoose.startSession();
    session.startTransaction();

    if (!postId) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Post not found",
      });
    }

    if (!userId) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "User not found",
      });
    }

    const post = await Post.findById(postId).session(session);
    if (!post) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Post not found",
      });
    }

    const postAuthor = await User.findById(post.author).session(session);
    if (!postAuthor) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Post Author not found",
      });
    }

    const me = await User.findById(userId).session(session);
    if (!me) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isSelf = postAuthor._id.toString() === userId.toString();

    if (!isSelf) {
      const isBlocked =
        postAuthor.blockedUsers.some(
          (id) => id.toString() === userId.toString(),
        ) ||
        me.blockedUsers.some(
          (id) => id.toString() === postAuthor._id.toString(),
        );

      if (isBlocked) {
        await session.abortTransaction();
        return res.status(400).json({
          message: "You are blocked by the user or you have blocked the user",
        });
      }

      const isPrivate = postAuthor.isPrivate;
      const isFollowed = postAuthor.followers.some(
        (id) => id.toString() === userId.toString(),
      );

      if (isPrivate && !isFollowed) {
        await session.abortTransaction();
        return res.status(400).json({
          message: "Private Account",
        });
      }
    }

    const alreadyLiked = post.likes.some(
      (id) => id.toString() === userId.toString(),
    );

    if (alreadyLiked) {
      post.likes = post.likes.filter(
        (id) => id.toString() !== userId.toString(),
      );
      me.likedPosts = me.likedPosts.filter(
        (id) => id.toString() !== postId.toString(),
      );
      // Delete notification
      await Notification.deleteOne({
        sender: userId,
        recipient: postAuthor._id,
        type: "like",
        targetType: "Post",
        targetId: postId,
      }).session(session);
    } else {
      post.likes.push(userId);
      me.likedPosts.push(postId);
      // Create notification if not liking own post
      if (userId.toString() !== postAuthor._id.toString()) {
        await Notification.create(
          [
            {
              sender: userId,
              recipient: postAuthor._id,
              type: "like",
              targetType: "Post",
              targetId: postId,
            },
          ],
          { session },
        );
      }
    }
    await post.save({ session });
    await me.save({ session });

    await session.commitTransaction();

    const responsePost = post.toObject();
    delete responsePost.mediaPublicId;

    return res.status(200).json({
      message: alreadyLiked
        ? "Post unliked successfully"
        : "Post liked successfully",
      liked: !alreadyLiked,
      post: responsePost,
    });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    return res.status(500).json({
      message: `Internal Server Error: ${error.message}`,
    });
  } finally {
    session?.endSession();
  }
};

const sendFollowRequest = async (req, res) => {
  let session = null;
  try {
    const targetUserId = req.params.id;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target User ID is required" });
    }

    if (targetUserId.toString() === userId.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const me = await User.findById(userId).session(session);
    const target = await User.findById(targetUserId).session(session);

    if (!me || !target) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }

    // Check block list
    const isBlocked =
      me.blockedUsers.some((id) => id.toString() === targetUserId.toString()) ||
      target.blockedUsers.some((id) => id.toString() === userId.toString());

    if (isBlocked) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Action not allowed" });
    }

    // Check if already following
    const alreadyFollowing = me.following.some(
      (id) => id.toString() === targetUserId.toString(),
    );

    if (alreadyFollowing) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Already following this user" });
    }

    // Check if request already sent
    const requestSent = me.sendRequest.some(
      (id) => id.toString() === targetUserId.toString(),
    );

    if (requestSent) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Follow request already sent" });
    }

    if (target.isPrivate) {
      me.sendRequest.push(targetUserId);
      target.receivedRequest.push(userId);

      await Notification.create(
        [
          {
            sender: userId,
            recipient: targetUserId,
            type: "follow_request",
          },
        ],
        { session },
      );

      await me.save({ session });
      await target.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        message: "Follow request sent successfully",
        requested: true,
        followed: false,
      });
    } else {
      me.following.push(targetUserId);
      target.followers.push(userId);

      await Notification.create(
        [
          {
            sender: userId,
            recipient: targetUserId,
            type: "follow",
          },
        ],
        { session },
      );

      await me.save({ session });
      await target.save({ session });
      await session.commitTransaction();

      return res.status(200).json({
        message: "Followed successfully",
        requested: false,
        followed: true,
      });
    }
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

const unFollowSomeOne = async (req, res) => {
  let session = null;
  try {
    const targetUserId = req.params.id;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target User ID is required" });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const me = await User.findById(userId).session(session);
    const target = await User.findById(targetUserId).session(session);

    if (!me || !target) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }

    me.following = me.following.filter(
      (id) => id.toString() !== targetUserId.toString(),
    );
    target.followers = target.followers.filter(
      (id) => id.toString() !== userId.toString(),
    );
    me.sendRequest = me.sendRequest.filter(
      (id) => id.toString() !== targetUserId.toString(),
    );
    target.receivedRequest = target.receivedRequest.filter(
      (id) => id.toString() !== userId.toString(),
    );

    // Delete follow notifications
    await Notification.deleteMany({
      $or: [
        {
          sender: userId,
          recipient: targetUserId,
          type: { $in: ["follow", "follow_request", "request_accepted"] },
        },
        { sender: targetUserId, recipient: userId, type: "request_accepted" },
      ],
    }).session(session);

    await me.save({ session });
    await target.save({ session });
    await session.commitTransaction();

    return res.status(200).json({ message: "Unfollowed successfully" });
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

const removeFollower = async (req, res) => {
  let session = null;
  try {
    const targetUserId = req.params.id;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target User ID is required" });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const me = await User.findById(userId).session(session);
    const target = await User.findById(targetUserId).session(session);

    if (!me || !target) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }

    me.followers = me.followers.filter(
      (id) => id.toString() !== targetUserId.toString(),
    );
    target.following = target.following.filter(
      (id) => id.toString() !== userId.toString(),
    );

    // Delete follow notifications
    await Notification.deleteMany({
      $or: [
        {
          sender: targetUserId,
          recipient: userId,
          type: { $in: ["follow", "follow_request", "request_accepted"] },
        },
        { sender: userId, recipient: targetUserId, type: "request_accepted" },
      ],
    }).session(session);

    await me.save({ session });
    await target.save({ session });
    await session.commitTransaction();

    return res.status(200).json({ message: "Follower removed successfully" });
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

const cancelSendedFollowRequest = async (req, res) => {
  let session = null;
  try {
    const targetUserId = req.params.id;
    const userId = req.userId;

    if (!targetUserId) {
      return res.status(400).json({ message: "Target User ID is required" });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const me = await User.findById(userId).session(session);
    const target = await User.findById(targetUserId).session(session);

    if (!me || !target) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }

    me.sendRequest = me.sendRequest.filter(
      (id) => id.toString() !== targetUserId.toString(),
    );
    target.receivedRequest = target.receivedRequest.filter(
      (id) => id.toString() !== userId.toString(),
    );

    await Notification.deleteOne({
      sender: userId,
      recipient: targetUserId,
      type: "follow_request",
    }).session(session);

    await me.save({ session });
    await target.save({ session });
    await session.commitTransaction();

    return res.status(200).json({ message: "Follow request cancelled" });
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

const acceptFollowRequest = async (req, res) => {
  let session = null;
  try {
    const requesterId = req.params.id;
    const userId = req.userId;

    if (!requesterId) {
      return res.status(400).json({ message: "Requester ID is required" });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const me = await User.findById(userId).session(session);
    const requester = await User.findById(requesterId).session(session);

    if (!me || !requester) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }

    const hasRequest = me.receivedRequest.some(
      (id) => id.toString() === requesterId.toString(),
    );

    if (!hasRequest) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "No follow request from this user" });
    }

    me.receivedRequest = me.receivedRequest.filter(
      (id) => id.toString() !== requesterId.toString(),
    );
    requester.sendRequest = requester.sendRequest.filter(
      (id) => id.toString() !== userId.toString(),
    );

    me.followers.push(requesterId);
    requester.following.push(userId);

    // Handle notifications
    await Notification.deleteOne({
      sender: requesterId,
      recipient: userId,
      type: "follow_request",
    }).session(session);

    await Notification.create(
      [
        {
          sender: userId,
          recipient: requesterId,
          type: "request_accepted",
        },
      ],
      { session },
    );

    await me.save({ session });
    await requester.save({ session });
    await session.commitTransaction();

    return res.status(200).json({ message: "Follow request accepted" });
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

const rejectFollowRequest = async (req, res) => {
  let session = null;
  try {
    const requesterId = req.params.id;
    const userId = req.userId;

    if (!requesterId) {
      return res.status(400).json({ message: "Requester ID is required" });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const me = await User.findById(userId).session(session);
    const requester = await User.findById(requesterId).session(session);

    if (!me || !requester) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }

    me.receivedRequest = me.receivedRequest.filter(
      (id) => id.toString() !== requesterId.toString(),
    );
    requester.sendRequest = requester.sendRequest.filter(
      (id) => id.toString() !== userId.toString(),
    );

    // Delete follow request notification
    await Notification.deleteOne({
      sender: requesterId,
      recipient: userId,
      type: "follow_request",
    }).session(session);

    await me.save({ session });
    await requester.save({ session });
    await session.commitTransaction();

    return res.status(200).json({ message: "Follow request rejected" });
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

const getPendingRequests = async (req, res) => {
  try {
    const userId = req.userId;

    const me = await User.findById(userId).populate(
      "receivedRequest",
      "username name profilePicture blockedUsers",
    );

    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    const filteredRequests = (me.receivedRequest || []).filter((u) => {
      if (!u || !u._id) return false;
      const isBlocked =
        (me.blockedUsers || []).some(
          (id) => id.toString() === u._id.toString(),
        ) ||
        (u.blockedUsers || []).some(
          (id) => id.toString() === userId.toString(),
        );
      return !isBlocked;
    });

    return res.status(200).json({ requests: filteredRequests });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const getWhoLikedPost = async (req, res) => {
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
    const usersWhoLiked = await User.find({
      _id: { $in: post.likes },
    })
      .select("_id username name profilePicture blockedUsers isPrivate stories")
      .populate({
        path: "stories",
        match: { deleteAt: { $gt: new Date() } },
      });

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
        stories: u.stories || [],
      }));

    return res.status(200).json({ users: filteredUsers });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const searchUser = async (req, res) => {
  try {
    const { query } = req.body;
    const searchInput = (query || "").replace(/\s+/g, "").toLowerCase();

    if (!searchInput) {
      return res.status(200).json({ users: [] });
    }

    const currentUserId = req.userId;
    const me = await User.findById(currentUserId);
    if (!me) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find users whose username starts with the input query
    const users = await User.find({
      username: { $regex: `^${searchInput}` },
    })
      .select("_id username name profilePicture blockedUsers isPrivate")
      .limit(50);

    // Filter out users who have blocked me or whom I have blocked
    const filteredUsers = users.filter((u) => {
      if (!u || !u._id) return false;
      const isBlocked =
        me.blockedUsers.some((id) => id.toString() === u._id.toString()) ||
        u.blockedUsers?.some(
          (id) => id.toString() === currentUserId.toString(),
        );
      return !isBlocked;
    });

    return res.status(200).json({ users: filteredUsers });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(400).json({ message: "User not found" });
    }

    const notifications = await Notification.find({ recipient: userId })
      .populate("sender", "username profilePicture name")
      .populate("targetId")
      .sort({ createdAt: -1 });

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(400).json({ message: "User not found" });
    }

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } },
    );

    return res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Internal Server Error: ${error.message}` });
  }
};

export {
  likePost,
  blockUser,
  unblockUser,
  comment,
  deleteComment,
  sendFollowRequest,
  unFollowSomeOne,
  cancelSendedFollowRequest,
  acceptFollowRequest,
  rejectFollowRequest,
  getPendingRequests,
  getWhoLikedPost,
  removeFollower,
  searchUser,
  getNotifications,
  markNotificationsRead,
};
