import OpenAI from 'openai';
import { exponentialRetry } from './retry';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chatCompletion(
  zone: string,
  reglement: string,
  parcelLabel: string,
): Promise<string> {
  const response = await exponentialRetry(async () => {
    const completion = await openai.chat.completions.create({
      model: 'o3-mini',
      messages: [
        {
          role: 'system',
          content:
            'Tu es un juriste spécialisé en droit de la construction valaisan. Réponds de façon concise et exhaustive, en français.',
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