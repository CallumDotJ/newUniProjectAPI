import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
console.log("OpenAI Key:", process.env.OPENAI_API_KEY ? "Loaded" : "Missing");
