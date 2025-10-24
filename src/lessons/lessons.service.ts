import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  // Create a new lesson
  async create(createLessonDto: CreateLessonDto) {
    return this.prisma.lesson.create({
      data: createLessonDto,
      select: { id: true, title: true, content: true },
    });
  }

  // Get all lessons
  async findAll() {
    return this.prisma.lesson.findMany();
  }

  // Get a lesson by id
  async findOne(id: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      select: { id: true, title: true, content: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    // Content is now always stored directly in the database
    return { id: lesson.id, title: lesson.title, content: lesson.content };
  }

  // Update a lesson by id
  async update(id: number, updateLessonDto: UpdateLessonDto) {
    return this.prisma.lesson.update({ where: { id }, data: updateLessonDto });
  }

  // Delete a lesson by id
  async remove(id: number) {
    await this.prisma.$transaction(async (tx) => {
      // Find quizzes under this lesson
      const quizzes = await tx.quiz.findMany({
        where: { lessonId: id },
        select: { id: true },
      });
      const quizIds = quizzes.map((q) => q.id);

      if (quizIds.length > 0) {
        // Delete attempt answers linked via attempts -> quiz
        await tx.quizAttemptAnswer.deleteMany({
          where: { attempt: { quizId: { in: quizIds } } },
        });
        // Delete attempts for these quizzes
        await tx.quizAttempt.deleteMany({ where: { quizId: { in: quizIds } } });
        // Delete answers for questions in these quizzes
        await tx.quizAnswer.deleteMany({
          where: { question: { quizId: { in: quizIds } } },
        });
        // Delete questions
        await tx.quizQuestion.deleteMany({
          where: { quizId: { in: quizIds } },
        });
        // Finally delete quizzes
        await tx.quiz.deleteMany({ where: { id: { in: quizIds } } });
      }

      // Delete user progress entries for this lesson
      await tx.userProgress.deleteMany({ where: { lessonId: id } });

      // Delete the lesson itself
      await tx.lesson.delete({ where: { id } });
    });

    return { id } as any;
  }
}
