import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const SYSTEM_INSTRUCTION = `You are an SEO-GEO-AEO Content Strategy Agent for website article production.

Your job is to generate high-quality, human-first, search-optimized, answer-ready, and generative-search-ready article assets.

You must help users create content that is:
- useful for human readers
- optimized for traditional SEO
- optimized for AEO answer formats
- structured for GEO and AI-search citation readiness
- compliant with search quality guidelines
- clear, factual, and editorially reviewable

Important rules:
- Write in Indonesian unless the user requests another language.
- Never invent statistics, citations, studies, prices, legal claims, medical claims, or financial advice.
- Mark uncertain claims as [SOURCE NEEDED].
- Avoid keyword stuffing.
- Avoid doorway pages.
- Avoid mass-produced generic content.
- Never promise guaranteed ranking.
- For YMYL topics such as health, finance, legal, or safety, add expert-review warnings.
- Make the article answer-first, easy to scan, and useful.
- Add practical examples and original insights where possible.

OUTPUT FORMAT:
Provide the complete package in the exact following structure. You MUST start each section with EXACTLY these heading strings so the system can parse them into tabs:
### Brief
(Include Search intent analysis, Keyword cluster, Entity map, and Content brief)

### Outline
(Include SEO outline)

### Article
(Include Full article draft and FAQ. 
Important instructions for the Article draft: 
1. You MUST write the actual, complete article content here.
2. You MUST explicitly label EVERY single structural element of the article draft.
3. Prefix each element with a bold label indicating its HTML tag, for example:
**[H1]** Judul Utama Artikel
**[Paragraph]** Ini adalah paragraf pembuka yang menjelaskan topik.
**[H2]** Subjudul Bagian Pertama
**[Paragraph]** Penjelasan untuk bagian pertama.
**[List]** 
- Poin 1
- Poin 2
**[Table]** (Tabel data)
This ensures the user knows exactly what HTML/structure applies to each block of text.)

### AEO
(Include AEO answer blocks)

### GEO
(Include GEO optimization notes, Internal link suggestions, External source suggestions)

### Metadata
(Include Metadata)

### Schema
(Include Schema recommendation)

### Plagiarism
(Include Plagiarism risk simulation, Uniqueness check, and originality score. Address whether this content brings new value compared to existing web articles.)

### Semantic
(Include Semantic NLP analysis, LSI keywords presence, Entity connections, and overall Semantic SEO score.)

### QA Checklist
(Include E-E-A-T checklist, Quality scores, Spam risk notes, Human editorial checklist)

You MUST start your response exactly with "### Brief", and use the exact headings specified above. Do not include any introductory or concluding remarks outside of these sections.`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // API Routes
  app.post("/api/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing" });
      }

      const { 
        topikUtama, 
        targetAudience, 
        tujuanArtikel, 
        toneBrand, 
        produkJasa, 
        jumlahKata,
        negaraBahasa, 
        kompetitor, 
        urlInternal, 
        sumberWajib, 
        batasanKlaim 
      } = req.body;

      if (!topikUtama) {
         return res.status(400).json({ error: "Topik utama is required" });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const userInput = `Here are the context inputs for the content piece:
1. Topik utama: ${topikUtama}
2. Target audience: ${targetAudience || 'Not specified'}
3. Tujuan artikel: ${tujuanArtikel || 'Not specified'}
4. Tone brand: ${toneBrand || 'Not specified'}
5. Produk/jasa yang disisipkan: ${produkJasa || 'None'}
6. Jumlah Kata yang Diinginkan: ${jumlahKata ? jumlahKata + ' kata' : 'Sesuai dengan kebutuhan SEO yang komprehensif'}
7. Negara/bahasa: ${negaraBahasa || 'Indonesia/Bahasa Indonesia'}
8. Kompetitor: ${kompetitor || 'Not specified'}
9. URL internal untuk dilink: ${urlInternal || 'Not specified'}
10. Sumber wajib: ${sumberWajib || 'Not specified'}
11. Batasan klaim: ${batasanKlaim || 'None'}

Please generate the complete SEO-GEO-AEO Content Package based on this input. Make sure the article length strictly meets the "Jumlah Kata yang Diinginkan" constraint if specified.`;

      const response = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: userInput,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of response) {
        if (chunk.text) {
           res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Error generating content:", error);
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  app.post("/api/edit", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing" });
      }

      const { content, prompt } = req.body;

      if (!content || !prompt) {
         return res.status(400).json({ error: "Content and prompt are required" });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const userInput = `Here is the current content package:

${content}

----
USER REVISION INSTRUCTION:
${prompt}

----
Please rewrite and update the complete content package strictly following the user's revision instruction. 
Ensure the output still adheres strictly to the original formatting, including the EXACT same headings: ### Brief, ### Outline, ### Article, etc. 
Do not add any conversational filler before or after the payload. Simply return the full, updated package.`;

      const response = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
        contents: userInput,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of response) {
        if (chunk.text) {
           res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();

    } catch (error: any) {
      console.error("Error editing content:", error);
      res.status(500).json({ error: error.message || "Failed to edit content" });
    }
  });

  app.post("/api/generate-alt-text", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing" });
      }

      const { imageBase64, context } = req.body;

      if (!imageBase64) {
         return res.status(400).json({ error: "Image is required" });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const mimeType = imageBase64.split(';')[0].split(':')[1];
      const base64Data = imageBase64.split(',')[1];
      
      const prompt = `Analyze this image and generate an SEO-optimized Alt text for it in Indonesian. Keep it descriptive, concise (around 5-15 words), and relevant to a blog article. Context of the article/topic: ${context || 'None'}. Return ONLY the alt text, without quotes.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ]
      });

      res.json({ altText: response.text });
    } catch (error: any) {
      console.error("Error generating alt text:", error);
      res.status(500).json({ error: error.message || "Failed to generate alt text" });
    }
  });

  app.post("/api/auto-fill", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY environment variable is missing" });
      }

      const { topikUtama } = req.body;

      if (!topikUtama) {
         return res.status(400).json({ error: "Topik Utama is required" });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Based on the following main topic for an SEO article, recommend appropriate values for the content parameters.
Topic: "${topikUtama}"

Provide the response strictly as a JSON object with the following keys, and nothing else:
{
  "tujuanArtikel": "Suggested article goal (e.g., Edukasi, Konversi, Brand Awareness)",
  "toneBrand": "Suggested brand tone (e.g., Profesional, Kasual, Informatif)",
  "produkJasa": "Leave empty or suggest a generic product/service related to the topic if applicable",
  "jumlahKata": "Suggested word count (e.g., 1000, 1500, 2000)",
  "negaraBahasa": "Indonesia/Bahasa Indonesia",
  "kompetitor": "List 2-3 generic types of competitors or leave empty",
  "urlInternal": "Leave empty",
  "sumberWajib": "Recommend types of authoritative sources to cite",
  "batasanKlaim": "Recommend any claim limitations to avoid legal/misinformation issues"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });

      const text = response.text || "{}";
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      
      let result = {};
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = text.substring(jsonStart, jsonEnd + 1);
        result = JSON.parse(jsonStr);
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error generating auto fill:", error);
      res.status(500).json({ error: "Failed to generate auto fill data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
