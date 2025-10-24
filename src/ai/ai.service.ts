import 'dotenv/config';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { LessonsService } from '../lessons/lessons.service';

@Injectable()
export class AiService {
  private client?: GoogleGenAI;

  constructor(private readonly lessonsService: LessonsService) {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
      // Helpful startup log (no key printed)

      console.log('[AI] Gemini 2.5 Flash client initialized');
    } else {
      console.warn(
        '[AI] GEMINI_API_KEY missing: AI endpoints will return not-configured',
      );
    }
  }

  async ask(params: {
    lessonId: number;
    question: string;
    language: 'en' | 'am';
  }) {
    try {
      const lesson = await this.lessonsService.findOne(params.lessonId);
      const system = `You are SEKUR, a cybersecurity tutor. Answer the user's question primarily using the provided lesson content when relevant. If the question is unrelated, you may use general knowledge, but keep answers concise and accurate. Provide examples when helpful. Language: ${
        params.language === 'am' ? 'Amharic' : 'English'
      }.`;

      const prompt = `${system}\n\nLesson Title: ${lesson.title}\n\nLesson Content (Markdown):\n${lesson.content}\n\nUser Question: ${params.question}`;

      if (!this.client) {
        throw new InternalServerErrorException(
          'AI is not configured on the server',
        );
      }
      const result = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const text = result.text;
      return { answer: text };
    } catch (e) {
      if (e instanceof InternalServerErrorException) throw e;
      throw new InternalServerErrorException('AI generation failed');
    }
  }
}
