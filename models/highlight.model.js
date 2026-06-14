import mongoose from "mongoose";

const HighlightSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    coverImage: {
      type: String,
      default: "",
    },

    coverImagePublicId: {
      type: String,
      default: "",
    },

    stories: [
      {
        mediaType: {
          type: String,
          enum: ["image", "video"],
          required: true,
        },

        mediaUrl: {
          type: String,
          required: true,
        },

        publicId: {
          type: String,
          required: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Highlight = mongoose.model("Highlight", HighlightSchema);

export default Highlight;