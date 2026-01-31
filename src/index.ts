import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./database";
import { router } from "./router";
const port = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use("/api/v1", router);
app.listen(port, () => {
  connectDB();
  console.log(`server is running on port ${port}`);
});
