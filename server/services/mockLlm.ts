import { loadMockAnswers } from "../loaders/artifactLoader";
import type { Question, Provider } from "@shared/schema";
import { OpenAIProvider } from "./openaiLlm";

export interface LLMResponse {
  answerText: string;
  citations: string[];
}

export class MockLLMProvider {
  private provider: Provider;

  constructor(provider: Provider = "mock-baseline") {
    this.provider = provider;
  }

  async getAnswer(question: Question): Promise<LLMResponse> {
    if (this.provider === "openai") {
      return {
        answerText: "[OpenAI integration not implemented]",
        citations: [],
      };
    }

    const providerMode = this.provider === "mock-after" ? "mock-after" : "mock-baseline";
    const answers = loadMockAnswers(providerMode);
    
    const answer = answers[question.id];
    
    if (answer) {
      return {
        answerText: answer.answer_text,
        citations: answer.citations || [],
      };
    }

    return {
      answerText: `Je ne dispose pas d'informations specifiques pour repondre a cette question sur "${question.topic}".`,
      citations: [],
    };
  }
}

export function createLlmProvider(provider: Provider): MockLLMProvider | OpenAIProvider {
  if (provider === "openai") {
    return new OpenAIProvider();
  }

  return new MockLLMProvider(provider);
}

export const mockLlmProvider = new MockLLMProvider("mock-baseline");
