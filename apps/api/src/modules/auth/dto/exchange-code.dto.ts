import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeCodeDto {
  @ApiProperty({ description: 'One-time exchange code from Google callback' })
  @IsString()
  code: string;
}