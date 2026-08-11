import OpenAI from "openai";
import type { Question, Provider } from "@shared/schema";
import type { LLMResponse } from "./mockLlm";

export class OpenAIProvider {
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY is not set. OpenAI provider will return an error response for each question.");
    }

    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30_000,
    });
  }

  async getAnswer(question: Question): Promise<LLMResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: question.text }],
      });

      const answerText = completion.choices[0]?.message?.content?.trim() || "";

      return {
        answerText,
        citations: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        answerText: `[ERROR: ${message}]`,
        citations: [],
      };
    }
  }
}
