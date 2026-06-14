import cron from "node-cron";
import Story from "../models/story.model.js";
import User from "../models/user.model.js";
import { cloudinary } from "../config/cloudinary.js";

cron.schedule("*/15 * * * *", async () => {
  console.log("Running story cleanup job...");

  try {
    const expiredStories = await Story.find({
      deleteAt: { $lte: new Date() },
    }).populate("author", "username");

    if (!expiredStories.length) {
      console.log("No expired stories found.");
      return;
    }

    for (const story of expiredStories) {
      try {
        console.log(
          `Deleting story ${story._id} of ${story.author?.username || "Unknown User"}`,
        );

        await cloudinary.uploader.destroy(story.mediaPublicId, {
          resource_type: story.mediaType === "video" ? "video" : "image",
        });

        await story.deleteOne();

        if (story.author && story.author._id) {
          await User.findByIdAndUpdate(story.author._id, {
            $pull: { stories: story._id },
          });
        }

        console.log(
          `Successfully deleted story ${story._id} of ${story.author?.username || "Unknown User"}`,
        );
      } catch (error) {
        console.error(
          `Failed to delete story ${story._id} of ${story.author?.username || "Unknown User"}:`,
          error.message,
        );
      }
    }

    console.log("Story cleanup job completed.");
  } catch (error) {
    console.error("Story cleanup job failed:", error.message);
  }
});
