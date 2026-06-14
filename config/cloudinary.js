import { v2 as cloudinary } from "cloudinary";
import multer from "multer"
cloudinary.config({
  secure: true,
});




const storage = multer.memoryStorage();


const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
});

// file size will throw error and upload type also(because of else) make a error middle ware
// //{
//   url: result.secure_url,      // image/video display karne ke liye
//   publicId: result.public_id   // Cloudinary me identify/delete/update karne ke liye
// }
//upload multer ka public id is for to take the name in which it will be saved

const uploadToCloudinary = (buffer, public_id) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
  {
    folder: "miniGram",
    public_id,
    resource_type: "auto",
  },
  (error, result) => {
    if (error) return reject(error);
    resolve(result);
  }
);

    stream.end(buffer);
  });
};
export {upload,uploadToCloudinary,cloudinary}
