import "dotenv/config";
import express from "express";
import { connectDB } from "./database";

const port = process.env.PORT || 3000;
const app = express();

app.listen(port, () => {
  connectDB();
  console.log(`server is running on port ${port}`);
});
