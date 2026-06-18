import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import User from "../models/user.model.js";
import { uploadToCloudinary, cloudinary } from "../config/cloudinary.js";
import path from "path";
import {getSocketId,io} from "../socket.js"


const sendMessage = async (req, res) => {
  let publicId = null;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { receiverId } = req.params;
    const senderId = req.userId;

    const user = await User.findById(receiverId).session(session);
    const me = await User.findById(senderId).session(session);

    if (!user || !me) {
      await session.abortTransaction();
      return res.status(404).json({ message: "User not found" });
    }

    const isBlocked =
      (me.blockedUsers &&
        me.blockedUsers.some(
          (id) => id.toString() === receiverId.toString(),
        )) ||
      (user.blockedUsers &&
        user.blockedUsers.some((id) => id.toString() === senderId.toString()));

    if (isBlocked) {
      await session.abortTransaction();
      return res
        .status(403)
        .json({
          message: "You are blocked by the user or you have blocked the user",
        });
    }

    if (
      user.isPrivate &&
      !user.followers.some((id) => id.toString() === senderId.toString())
    ) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Private Account" });
    }

    let msg;
    const { message } = req.body;

    if (!req.file) {
      msg = new Message({
        senderId,
        receiverId,
        message,
      });
    } else {
      const originalName = path.parse(req.file.originalname).name;

      const cleanName = originalName
        .replace(/\s+/g, "_")
        .replace(/[^\w\-]/g, "");

      const uniqueName = `${user.username}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 8)}_${cleanName}`;

      const result = await uploadToCloudinary(req.file.buffer, uniqueName);

      const { secure_url, public_id, resource_type } = result;

      publicId = public_id;

      if (resource_type === "video") {
        msg = new Message({
          senderId,
          receiverId,
          video: secure_url,
          publicId,
          resourceType: resource_type,
        });
      }

      if (resource_type === "image") {
        msg = new Message({
          senderId,
          receiverId,
          image: secure_url,
          publicId,
          resourceType: resource_type,
        });
      }

      if (!msg) {
        await session.abortTransaction();
        return res.status(400).json({
          message: "Unsupported file type",
        });
      }
    }
    const receiverSocketId = getSocketId(receiverId);
    if(receiverSocketId){
      io.to(receiverSocketId).emit("newMessage", msg);
    }

    await msg.save({ session });

    const existconversation = await Conversation.findOne({
      participants: {
        $all: [senderId, receiverId],
      },
    }).session(session);

    if (!existconversation) {
      const conversation = new Conversation({
        participants: [senderId, receiverId],
        messages: [msg._id],
        lastMsgSentForId: receiverId,
        isSeen: false,
      });

      await conversation.save({ session });
    } else {
      existconversation.messages.push(msg._id);
      existconversation.lastMsgSentForId = receiverId;
      existconversation.isSeen = false;
      await existconversation.save({ session });
    }

    await session.commitTransaction();

    return res.status(201).json({
      message: "Message sent successfully",
      newMessage: msg,
    });
  } catch (error) {
    await session.abortTransaction();

    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }

    return res.status(500).json({
      message: error.message,
    });
  } finally {
    session.endSession();
  }
};

const getAllMessaageBetweenTwoUsers = async (req, res) => {
  try {
    const { userId } = req.params;
    const senderId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existconversation = await Conversation.findOne({
      participants: {
        $all: [senderId, userId],
      },
    }).populate("messages", "-publicId");

    if (!existconversation) {
      return res.status(200).json({ messages: [] });
    }

    const entry = existconversation.deletedBy?.find(
      (e) => e.userId.toString() === senderId.toString()
    );

    let messages = existconversation.messages || [];
    if (entry) {
      messages = messages.filter(
        (m) => new Date(m.createdAt) > new Date(entry.deletedAt)
      );
    }

    if (
      existconversation.lastMsgSentForId?.toString() === senderId.toString() &&
      !existconversation.isSeen
    ) {
      existconversation.isSeen = true;
      await existconversation.save();
    }

    return res.status(200).json({ messages });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getUserChatList = async (req, res) => {
  try {
    const senderId = req.userId;

    const conversations = await Conversation.find({
      participants: {
        $in: [senderId],
      },
    })
      .populate("participants", "name username profilePicture")
      .sort({ updatedAt: -1 });

    if (!conversations) {
      return res.status(200).json({ chatList: [] });
    }

    const chatList = [];
    for (const conversation of conversations) {
      const entry = conversation.deletedBy?.find(
        (e) => e.userId.toString() === senderId.toString()
      );
      const lastMessage = await Message.findOne({
        _id: { $in: conversation.messages }
      }).sort({ createdAt: -1 }) || null;

      if (entry) {
        if (!lastMessage || new Date(lastMessage.createdAt) <= new Date(entry.deletedAt)) {
          continue;
        }
      }

      let otherParticipant = null;
      if (
        conversation.participants[0]?._id?.toString() === senderId.toString()
      ) {
        otherParticipant = conversation.participants[1] || null;
      } else {
        otherParticipant = conversation.participants[0] || null;
      }

      const glow =
        conversation.lastMsgSentForId?.toString() === senderId.toString() &&
        conversation.isSeen === false;

      chatList.push({
        conversationId: conversation._id,
        updatedAt: conversation.updatedAt,
        otherParticipant,
        lastMessage,
        glow,
      });
    }

    return res.status(200).json({ chatList });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const unSendMessage = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { messageId } = req.params;
    const userId = req.userId;

    if (!messageId) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Message ID is required",
      });
    }

    const message = await Message.findById(messageId).session(session);

    if (!message) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (message.senderId.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        message: "You are not authorized to unsend this message",
      });
    }

    const conversation = await Conversation.findOne({
      participants: {
        $all: [message.senderId, message.receiverId],
      },
    }).session(session);

    if (!conversation) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const isLastMessage =
      conversation.messages[conversation.messages.length - 1]?.toString() ===
      messageId;

    conversation.messages.pull(message._id);

    if (isLastMessage) {
      const newLastId = conversation.messages[conversation.messages.length - 1];
      if (!newLastId) {
        await Conversation.deleteOne({ _id: conversation._id }).session(
          session,
        );
      } else {
        const newLastMsg = await Message.findById(newLastId).session(session);
        if (newLastMsg?.senderId.toString() !== userId.toString()) {
          conversation.lastMsgSentForId = newLastMsg.senderId;
          conversation.isSeen = true;
        }
        await conversation.save({ session });
      }
    } else {
      await conversation.save({ session });
    }

    await Message.deleteOne({ _id: message._id }).session(session);

    await session.commitTransaction();

    if (message?.publicId) {
      try {
        await cloudinary.uploader.destroy(message.publicId, {
          resource_type: message?.resourceType || "image",
        });
      } catch (cloudinaryError) {
        console.error("Cloudinary delete failed:", cloudinaryError);
      }
    }

    return res.status(200).json({
      message: "Message unsent successfully",
    });
  } catch (error) {
    await session.abortTransaction();

    return res.status(500).json({
      message: error.message,
    });
  } finally {
    session.endSession();
  }
};

const getUnreadMessageCount = async (req, res) => {
  try {
    const senderId = req.userId;
    const unreadCount = await Conversation.countDocuments({
      lastMsgSentForId: senderId,
      isSeen: false,
    });
    return res.status(200).json({ unreadCount });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const searchUsersForChat = async (req, res) => {
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

    const users = await User.find({
      username: { $regex: `^${searchInput}`, $options: "i" },
    })
      .select(
        "_id username name profilePicture blockedUsers isPrivate following followers",
      )
      .limit(50);

    const filteredUsers = users.filter((u) => {
      if (!u || !u._id) return false;
      if (u._id.toString() === currentUserId.toString()) return false;

      const isBlocked =
        me.blockedUsers.some((id) => id.toString() === u._id.toString()) ||
        u.blockedUsers?.some(
          (id) => id.toString() === currentUserId.toString(),
        );
      if (isBlocked) return false;

      const isPublic = !u.isPrivate;
      const isFollowing = me.following.some(
        (id) => id.toString() === u._id.toString(),
      );

      return isPublic || isFollowing;
    });

    return res.status(200).json({ users: filteredUsers });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteAllMessages = async (req, res) => {
  let session = null;
  try {
    const { userId } = req.params;
    const senderId = req.userId;

    session = await mongoose.startSession();
    session.startTransaction();

    const conversation = await Conversation.findOne({
      participants: {
        $all: [senderId, userId],
      },
    }).session(session);

    if (!conversation) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Conversation not found" });
    }

    const now = new Date();
    const senderEntryIndex = conversation.deletedBy.findIndex(
      (entry) => entry.userId.toString() === senderId.toString()
    );
    if (senderEntryIndex > -1) {
      conversation.deletedBy[senderEntryIndex].deletedAt = now;
    } else {
      conversation.deletedBy.push({ userId: senderId, deletedAt: now });
    }

    if (conversation.lastMsgSentForId?.toString() === senderId.toString()) {
      conversation.isSeen = true;
    }

    const participantIds = conversation.participants.map((id) => id.toString());
    const deletedByUsers = conversation.deletedBy.map((entry) => entry.userId.toString());
    const allParticipantsDeleted = participantIds.every((id) => deletedByUsers.includes(id));

    let publicIds = [];

    if (allParticipantsDeleted) {
      const messageIds = conversation.messages;
      const messages = await Message.find({ _id: { $in: messageIds } }).session(session);

      publicIds = messages
        .filter((m) => m?.publicId)
        .map((m) => ({ id: m.publicId, type: m?.resourceType || "image" }));

      await Message.deleteMany({ _id: { $in: messageIds } }).session(session);
      await Conversation.deleteOne({ _id: conversation._id }).session(session);
    } else {
      await conversation.save({ session });
    }

    await session.commitTransaction();

    for (const asset of publicIds) {
      try {
        await cloudinary.uploader.destroy(asset.id, {
          resource_type: asset.type,
        });
      } catch (cloudinaryError) {
        console.error(
          "Cloudinary delete failed inside deleteAllMessages:",
          cloudinaryError,
        );
      }
    }

    return res
      .status(200)
      .json({ message: "All messages deleted successfully" });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    return res.status(500).json({ message: error.message });
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

export {
  sendMessage,
  getAllMessaageBetweenTwoUsers,
  getUserChatList,
  unSendMessage,
  getUnreadMessageCount,
  searchUsersForChat,
  deleteAllMessages,
};
