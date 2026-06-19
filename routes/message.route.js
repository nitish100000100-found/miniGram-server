import express from "express";
const messageRouter = express.Router();
import {
    sendMessage,
    getAllMessaageBetweenTwoUsers,
    getUserChatList,
    unSendMessage,
    getUnreadMessageCount,
    searchUsersForChat,
    deleteAllMessages
} from "../controllers/message.controller.js";

import isAuth from "../middleware/isAuth.middleware.js";
import { upload } from "../config/cloudinary.js";


messageRouter.post("/sendMessage/:receiverId",isAuth,upload.single("media"), sendMessage);
messageRouter.get("/getMessages/:userId",isAuth, getAllMessaageBetweenTwoUsers);
messageRouter.get("/getUserChatList",isAuth, getUserChatList);
messageRouter.post("/unsendMessage/:messageId", isAuth, unSendMessage);
messageRouter.get("/unreadCount", isAuth, getUnreadMessageCount);
messageRouter.post("/searchUsers", isAuth, searchUsersForChat);
messageRouter.post("/clearChat/:userId", isAuth, deleteAllMessages);

export default messageRouter;

