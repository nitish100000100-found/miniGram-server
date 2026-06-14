import "./config/env.js";
import app from "./app.js";
import "./cronjobs/story.cron.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 3000;


connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🌐 Allowed Origins: ${process.env.ALLOWED_ORIGINS}`);
    });
  })
  .catch((err) => {
    console.error("DB Connection Failed:", err);
    process.exit(1);
  });