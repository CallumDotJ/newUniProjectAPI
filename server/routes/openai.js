import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const router = express.Router();

// store im memory so can send to OpenAI
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.get("/debug", (req, res) => {
  res.json({ message: "Debug endpoint is working. POST an image + notes to test." });
});

router.post("/debug", upload.single("image"), async (req, res) => {
  try {
    const notes = req.body?.notes || "";
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No image uploaded. Expected field name: image" });
    }

    const base64 = file.buffer.toString("base64");
    const dataUrl = `data:${file.mimetype};base64,${base64}`;

    const response = await client.chat.completions.create({ // chat 4o mini .completion instead of response.create
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a study companion that creates flashcards. " +
            "Return ONLY valid JSON as an array of objects with keys question and answer.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Create 4 flashcards from these notes: ${notes}` },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";

    const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")  // remove leading ``` or ```json
      .replace(/```$/i, "")             // remove trailing ```
      .trim();

    let parsed = [];
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(200).json({
        output: [],
        raw,
        warning: "Model did not return valid JSON, See raw.",
      });
    }

    res.json({ output: parsed });
  } catch (err) {
    console.error("OpenAI Error", err);
    res.status(500).json({
      error: "failed to generate study material",
      message: err?.message,
      status: err?.status,
      type: err?.type,
    });
  }
});


router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body;  
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "invalid messages formaat, expected an array of messages" });
    } 
    const response = await client.chat.completions.create({
      model: "gpt-4o", // least to give image understanding
      messages: messages,
    });
    res.json({ output: response.choices[0].message });
  } catch (err) {
    console.error("open ai error", err);
    res.status(500).json({ error: "Failed to generate chat response" });
  }
});

export default router;
