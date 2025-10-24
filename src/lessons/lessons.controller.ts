import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { QuizzesService } from '../quizzes/quizzes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('lessons')
export class LessonsController {
  constructor(
    private lessonsService: LessonsService,
    private quizzesService: QuizzesService, // Inject QuizzesService
  ) {}

  // POST /lessons - create a new lesson (Admin only)
  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    createLessonDto: CreateLessonDto,
  ) {
    return this.lessonsService.create(createLessonDto);
  }

  // GET /lessons - get all lessons
  @Get()
  async findAll() {
    return this.lessonsService.findAll();
  }

  // GET /lessons/:id - get a lesson by id
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.findOne(id);
  }

  // GET /lessons/:id/quiz - get the quiz for a lesson by lesson ID
  @Get(':id/quiz')
  async getQuiz(@Param('id', ParseIntPipe) id: number) {
    return this.quizzesService.findByLessonId(id);
  }

  // PATCH /lessons/:id - update a lesson by id (Admin only)
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    updateLessonDto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(id, updateLessonDto);
  }

  // DELETE /lessons/:id - delete a lesson by id (Admin only)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.lessonsService.remove(id);
  }
}
