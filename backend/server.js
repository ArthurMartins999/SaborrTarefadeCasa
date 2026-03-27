import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

/* ===============================
   TESTE DE SAÚDE
================================ */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Backend online 🚀" });
});

/* ===============================
   ROTA DA IA (GEMINI)
================================ */
app.post("/api/ai", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt vazio" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY não encontrada no .env"
      });
    }

    const systemPrompt = `
Você é um assistente de estudos.
Responda em português do Brasil.

Regras:
- Seja claro e direto
- Se for resumo: faça em tópicos
- Se for matemática: mostre conta + resposta final
- Use linguagem simples (nível escola)
`.trim();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\nPergunta:\n${prompt}`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    console.log("RESPOSTA GEMINI:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Erro na API Gemini",
        details: data
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Não consegui gerar resposta.";

    return res.json({ text });
  } catch (error) {
    console.error("ERRO INTERNO:", error);
    return res.status(500).json({
      error: "Erro interno no servidor",
      details: String(error)
    });
  }
});

/* ===============================
   START
================================ */
const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});