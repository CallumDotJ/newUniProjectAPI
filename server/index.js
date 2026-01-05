import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import openaiRoutes from "./routes/openai.js";

dotenv.config();

console.log("OpenAI Key:", process.env.OPENAI_API_KEY ? "Loaded" : "Missing");

const app = express();

app.use(cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Router Routes
app.use("/api/openai", openaiRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));