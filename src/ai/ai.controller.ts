import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  async ask(@Body() body: { lessonId: number; question: string; language?: 'en' | 'am' }) {
    const { lessonId, question, language } = body;
    return this.aiService.ask({ lessonId, question, language: language || 'en' });
  }
}


