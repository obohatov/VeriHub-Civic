import { beforeAll, describe, it, expect } from "vitest";
import { createLlmProvider, MockLLMProvider } from "../../services/mockLlm";
import { OpenAIProvider } from "../../services/openaiLlm";

describe("createLlmProvider", () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = "sk-test-dummy";
  });

  it("returns an OpenAIProvider for the openai provider", () => {
    const provider = createLlmProvider("openai");
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it("keeps the mock provider for the baseline provider", () => {
    const provider = createLlmProvider("mock-baseline");
    expect(provider).toBeInstanceOf(MockLLMProvider);
  });
});
