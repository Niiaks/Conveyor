import express from "express";
import { uploadController } from "../controller/upload.controller";
import { notifyController } from "../controller/notify.controller";

export const router = express.Router();

router.post("/upload", uploadController);
router.post("/upload/notify", notifyController);
