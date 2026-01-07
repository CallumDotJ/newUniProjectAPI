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
      "You are an expert block-based programming debugging tutor (Scratch/Blockly style). " +
      "The user provides a screenshot of block code and optional notes. " +
      "Your job: identify likely logic and/or structural issues, explain what the blocks do in pseudocode, " +
      "and give guided, educational fixes and a final corrected solution.\n\n" +

      "return ONLY valid JSON, do not include markdown, backticks, commentary, or extra text.\n\n" + // to ensure parsable

      "Output must be ONLY a single JSON object with exactly these top-level keys:\n" +
        "- summary\n" +
      "- assumptions\n" +
        "- identifiedIssues\n" +
      "- pseudocodeLocation\n" +
        "- hints\n" +
      "- officialAnswer\n\n" +

      "rules:\n" +

      "1) even if the screenshot is unclear, still make best effort assumptions and state them in assumptions.\n" + // encourage best effort
      "2) Be specific about where the issue is [e.g. 'inside the forever loop', 'in the if branch that checks 'condition', 'after setting variable X'].\n" + // location specificity
      "3) Keep hints incremental, therefore it's more educationally biased : hint 1 minimal, hint 2 more direct, hint 3 near-solution.\n" + // scaffolded hints
      "4) Never output anything except the JSON object." // enforce parsable
  },
  {
    role: "user",
    content: [
      {
        type: "text",
        text:
          `Debug this block program from the screenshot. Notes (might be empty): ${notes}\n\n` +
          "Required output details:\n" +
   "- summary: 1-2 sentences describing what the program appears intended to do.\n" +
     "- assumptions: array of strings.\n" +
           "- identifiedIssues: array of objects {id, title, severity, evidence, whyItBreaks, fix}. Severity: 'low' | 'medium' | 'high'.\n" + // explain why it breaks - use severity ratings
          "- pseudocodeLocation: object {currentBehaviorPseudocode, whereItGoesWrong, correctedLogicPseudocode}.\n" + 
          "- hints: array of 3 objects {level, hint} where level is 1,2,3.\n" +
           "- officialAnswer: object {finalPseudocode, blockFixSteps, commonMistakesToAvoid}.\n"
      },
      { type: "image_url", image_url: { url: dataUrl } }
    ]
  }
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || "";

    const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")  // remove leading ``` or ```json
      .replace(/```$/i, "")             // remove trailing ```
      .trim();

    let parsed = []; //hold store for parsing output

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
