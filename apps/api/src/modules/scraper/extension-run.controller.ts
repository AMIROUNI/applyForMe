import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  extensionTaskUpdateSchema,
  type ExtensionTaskAssignment,
  type ExtensionTaskList,
  type ExtensionTaskUpdate,
  type ScraperRun,
} from '@agency-apply/shared';
import { ExtensionAuthGuard } from '../extension/extension.guard';
import { ScraperService } from './scraper.service';

@Controller('extension')
@Public()
@UseGuards(ExtensionAuthGuard)
export class ExtensionRunController {
  constructor(private readonly scraper: ScraperService) {}

  @Get('tasks')
  async listTasks(@CurrentUser() user: { id: string }): Promise<ExtensionTaskList> {
    const tasks: ExtensionTaskAssignment[] = await this.scraper.listExtensionTasks(user.id);
    return { tasks };
  }

  @Patch('tasks/:taskId')
  updateTask(
    @CurrentUser() user: { id: string },
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(extensionTaskUpdateSchema)) body: ExtensionTaskUpdate
  ): Promise<ScraperRun> {
    return this.scraper.updateTaskByExtension(user.id, taskId, body);
  }
}
