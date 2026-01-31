import multer from "multer";
import multerS3 from "multer-s3";
import { minioClient } from "../lib";

export const upload = multer({
  storage: multerS3({
    s3: minioClient,
    bucket: "buck1",
    key: (req, file, cb) => {
      cb(null, Date.now().toString() + "-" + file.originalname);
    },
  }),
});
