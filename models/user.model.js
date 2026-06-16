import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: "",
    },

    username: {
      type: String,
      required: true,
      unique: true,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      default: "",
    },

    password: {
      type: String,
      required: true,
      default: "",
    },

    profilePicture: {
      type: String,
      default: "",
    },

    public_id: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      default: "",
    },

    profession: {
      type: String,
      default: "",
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other",""],
      default: "",
    },

    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    savedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],

    savedLoops: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Loop",
      },
    ],

    sendRequest: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    receivedRequest: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    posts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    likedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    highlights: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Highlight",
      },
    ],
    isPrivate: {
      type: Boolean,
      default: false,
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    loops:[
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Loop",
      }
    ],
    stories:[
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Story",
      }
    ]
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", UserSchema);

export default User;
