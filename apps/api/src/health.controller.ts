import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness + database connectivity check' })
  check(): { status: string; database: string; uptime: number } {
    const dbState = this.connection.readyState;
    return {
      status: 'ok',
      database: dbState === 1 ? 'connected' : 'disconnected',
      uptime: Math.floor(process.uptime()),
    };
  }
}