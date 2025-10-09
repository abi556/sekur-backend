import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuizDto, QuestionType } from './dto/create-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Injectable()
export class QuizzesService {
  constructor(private prisma: PrismaService) {}

  // List all quizzes with lesson and questions
  async findAll() {
    return this.prisma.quiz.findMany({
      orderBy: { id: 'desc' },
      include: {
        lesson: { select: { id: true, title: true } },
        questions: { select: { id: true } },
      },
    });
  }

  // Create a quiz with questions and answers
  async create(lessonId: number, title: string, questions: any[]) {
    // Ensure a lesson can only have one quiz
    const existing = await this.prisma.quiz.findFirst({ where: { lessonId } });
    if (existing) {
      throw new ConflictException('A quiz is already set up for this lesson');
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new BadRequestException('Quiz must have at least 1 question');
    }

    return this.prisma.quiz.create({
      data: {
        lessonId,
        title,
        questions: {
          create: questions.map((q: any) => ({
            question: q.text,
            type: q.type || QuestionType.MULTIPLE_CHOICE,
            correctAnswer: q.correctAnswer,
            points: q.points || 1,
            answers: {
              create: (q.answers || []).map((a: any) => ({
                answer: a.text,
                isCorrect: a.isCorrect,
                letter: a.letter,
              })),
            },
          })),
        },
      },
      include: { questions: { include: { answers: true } } },
    });
  }

  // Get a quiz by quiz ID
  async findOne(id: number) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: { questions: { include: { answers: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    return quiz;
  }

  // Get a quiz by lesson ID
  async findByLessonId(lessonId: number) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { lessonId },
      include: { questions: { include: { answers: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found for this lesson');
    return quiz;
  }

  // Update a quiz (title/questions/answers)
  async update(id: number, data: any) {
    // Optional: move quiz to another lesson, enforce uniqueness constraint
    if (data.lessonId) {
      const existing = await this.prisma.quiz.findFirst({
        where: { lessonId: data.lessonId, NOT: { id } },
        select: { id: true },
      })
      if (existing) {
        throw new ConflictException('A quiz is already set up for this lesson')
      }
    }

    // For simplicity, delete old questions/answers and recreate
    await this.prisma.quizQuestion.deleteMany({ where: { quizId: id } })

    return this.prisma.quiz.update({
      where: { id },
      data: {
        title: data.title,
        lessonId: data.lessonId ?? undefined,
        questions: {
          create: (data.questions || []).map((q: any) => ({
            question: q.text,
            type: q.type || QuestionType.MULTIPLE_CHOICE,
            correctAnswer: q.correctAnswer,
            points: q.points || 1,
            answers: {
              create: (q.answers || []).map((a: any) => ({
                answer: a.text,
                isCorrect: a.isCorrect,
                letter: a.letter,
              })),
            },
          })),
        },
      },
      include: { questions: { include: { answers: true } } },
    })
  }

  // Delete a quiz
  async remove(id: number) {
    await this.prisma.$transaction(async (tx) => {
      // Delete attempt answers linked to this quiz via attempts
      await tx.quizAttemptAnswer.deleteMany({
        where: {
          attempt: { quizId: id },
        },
      })

      // Delete answers for questions in this quiz
      await tx.quizAnswer.deleteMany({
        where: {
          question: { quizId: id },
        },
      })

      // Delete questions for this quiz
      await tx.quizQuestion.deleteMany({ where: { quizId: id } })

      // Delete attempts for this quiz
      await tx.quizAttempt.deleteMany({ where: { quizId: id } })

      // Finally delete the quiz
      await tx.quiz.delete({ where: { id } })
    })

    return { id }
  }

  // Submit quiz answers and evaluate
  async submitQuiz(quizId: number, submitQuizDto: SubmitQuizDto, userId: number) {
    const quiz = await this.findOne(quizId);
    let totalScore = 0;
    const maxScore = quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const results: any[] = [];

    for (const answer of submitQuizDto.answers) {
      const question = quiz.questions.find(q => q.id === answer.questionId);
      if (!question) continue;

      let isCorrect = false;
      let pointsEarned = 0;

      // Evaluate based on question type
      switch (question.type) {
        case QuestionType.MULTIPLE_CHOICE:
          const correctAnswer = question.answers.find(a => a.isCorrect);
          isCorrect = correctAnswer ? answer.userAnswer === correctAnswer.answer : false;
          break;
        
        case QuestionType.TRUE_FALSE:
          isCorrect = answer.userAnswer.toLowerCase() === (question.correctAnswer?.toLowerCase() || '');
          break;
        
        case QuestionType.FILL_IN_BLANK:
          isCorrect = answer.userAnswer.toLowerCase().trim() === (question.correctAnswer?.toLowerCase().trim() || '');
          break;
        
        case QuestionType.SHORT_ANSWER:
          // For short answer, we could implement fuzzy matching or exact match
          isCorrect = answer.userAnswer.toLowerCase().trim() === (question.correctAnswer?.toLowerCase().trim() || '');
          break;
      }

      if (isCorrect) {
        pointsEarned = question.points || 1;
        totalScore += pointsEarned;
      }

      results.push({
        questionId: answer.questionId,
        userAnswer: answer.userAnswer,
        isCorrect,
        pointsEarned,
        correctAnswer: this.getCorrectAnswer(question),
      });
    }

    // Calculate percentage first
    const percentage = Math.round((totalScore / maxScore) * 100);
    
    // Create quiz attempt record
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        userId,
        quizId,
        score: totalScore,
        maxScore,
        completed: percentage >= 75, // Only mark as completed if score >= 75%
        completedAt: new Date(),
        answers: {
          create: results.map((r: any) => ({
            questionId: r.questionId,
            userAnswer: r.userAnswer,
            isCorrect: r.isCorrect,
            pointsEarned: r.pointsEarned,
          })),
        },
      },
      include: { answers: true },
    });
    
    // If user scored 75% or higher, automatically mark the lesson as completed
    if (percentage >= 75) {
      try {
        // Get the lesson ID from the quiz
        const quizWithLesson = await this.prisma.quiz.findUnique({
          where: { id: quizId },
          select: { lessonId: true },
        });
        
        if (quizWithLesson) {
          // Mark lesson as completed in user progress
          await this.prisma.userProgress.upsert({
            where: {
              userId_lessonId: {
                userId,
                lessonId: quizWithLesson.lessonId,
              },
            },
            update: {
              completed: true,
            },
            create: {
              userId,
              lessonId: quizWithLesson.lessonId,
              completed: true,
            },
          });
          
          console.log(`Lesson ${quizWithLesson.lessonId} automatically marked as completed for user ${userId} (Quiz score: ${percentage}%)`);
        }
      } catch (error) {
        console.error('Error updating lesson progress:', error);
        // Don't fail the quiz submission if progress update fails
      }
    }

    return {
      attemptId: attempt.id,
      score: totalScore,
      maxScore,
      percentage,
      results,
      completedAt: attempt.completedAt,
      lessonCompleted: percentage >= 75,
    };
  }

  // Get correct answer for a question (without revealing it to user)
  private getCorrectAnswer(question: any) {
    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
        const correct = question.answers.find((a: any) => a.isCorrect);
        return correct ? correct.answer : null;
      case QuestionType.TRUE_FALSE:
      case QuestionType.FILL_IN_BLANK:
      case QuestionType.SHORT_ANSWER:
        return question.correctAnswer;
      default:
        return null;
    }
  }

  // Get user's quiz attempts
  async getUserAttempts(quizId: number, userId: number) {
    return this.prisma.quizAttempt.findMany({
      where: { quizId, userId },
      include: { answers: true },
      orderBy: { startedAt: 'desc' },
    });
  }
}
