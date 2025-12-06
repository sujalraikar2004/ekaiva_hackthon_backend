// src/utils/llmService.js
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const processMeetingTranscription = async (transcriptionText, participants) => {
  try {
    const prompt = `Analyze this meeting transcript and extract action items. For each action item, identify:
1. The person responsible (from this list: ${participants.join(', ')})
2. The task description
3. The due date if mentioned

Format the response as a JSON array of objects with: assignee, task, and dueDate.

Transcript:
${transcriptionText}

Response:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const content = completion.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error('Error processing transcription with LLM:', error);
    throw new Error('Failed to process meeting transcription');
  }
};