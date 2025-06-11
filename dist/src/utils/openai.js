"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatCompletion = chatCompletion;
const openai_1 = __importDefault(require("openai"));
const retry_1 = require("./retry");
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
async function chatCompletion(zone, reglement, parcelLabel) {
    const response = await (0, retry_1.exponentialRetry)(async () => {
        const completion = await openai.chat.completions.create({
            model: 'o3-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Tu es un juriste spécialisé en droit de la construction valaisan. Réponds de façon concise et exhaustive, en français.',
                },
                {
                    role: 'user',
                    content: `ZONE: ${zone}\n\nRÈGLEMENT:\n${reglement}\n\nQUESTION: Quelles contraintes s'appliquent à la parcelle ${parcelLabel} ?`,
                },
            ],
        });
        return completion.choices[0].message.content ?? '';
    });
    return response;
}
