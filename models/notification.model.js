import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "comment", "follow", "follow_request", "request_accepted"],
      required: true,
    },
    targetType: {
      type: String,
      enum: ["Post", "Loop"],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "targetType",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Notification", NotificationSchema);
