import mongoose from "mongoose";

let dbUrl = process.env.DB_URL!;

export async function connectDB() {
  await mongoose
    .connect(dbUrl)
    .then(() => console.log("db connected"))
    .catch((err) => console.log("error connecting to mongodb", err));
}
