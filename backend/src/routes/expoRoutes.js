import { Router } from "express";
import multer from "multer";
import {
  getLeads,
  createLead,
  updateLead,
  markWhatsAppBroadcast,
  getBroadcastConfig,
  sendBroadcast,
  uploadMedia,
} from "../controllers/expoController.js";
import { ApiError } from "../utils/apiError.js";

const router = Router();

// File is kept in memory and sent straight to Cloudinary (nothing is saved on your server)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG or WEBP images are allowed"));
  },
});

const handleUpload = (req, res, next) =>
  upload.single("image")(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "Image must be smaller than 5 MB" : err.message;
      return next(ApiError.badRequest(msg));
    }
    next();
  });

router.get("/", getLeads);
router.post("/", createLead);
router.get("/broadcast/config", getBroadcastConfig);
router.post("/broadcast/send", sendBroadcast);
router.post("/broadcast", markWhatsAppBroadcast);
router.post("/media", handleUpload, uploadMedia);
router.put("/:id", updateLead);

export default router;