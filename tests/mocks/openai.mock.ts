import { vi } from 'vitest';

vi.mock('openai', () => {
  class FakeOpenAI {
    // eslint-disable-next-line class-methods-use-this
    chat = {
      completions: {
        create: async () => ({
          choices: [{ message: { content: 'Indice brut : 0.8; Hauteur max : 12 m.' } }],
        }),
      },
    };
  }
  return { default: FakeOpenAI };
}); 