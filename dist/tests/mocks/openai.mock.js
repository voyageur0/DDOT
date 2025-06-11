"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock('openai', () => {
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
