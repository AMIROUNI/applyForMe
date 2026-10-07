import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type ScrapeRunDocument = ScrapeRun & Document;

@Schema({ timestamps: true, collection: 'scrape_runs' })
export class ScrapeRun {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, default: 'queued' })
  status: 'queued' | 'running' | 'done' | 'failed';

  @Prop({ type: [String], default: [] })
  sources: string[];

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: [String], default: [] })
  countries: string[];

  @Prop({ default: false })
  remoteOnly: boolean;

  @Prop({
    type: { total: Number, done: Number, found: Number },
    default: { total: 0, done: 0, found: 0 },
  })
  progress: { total: number; done: number; found: number };

  @Prop({
    type: [{ source: String, message: String }],
    default: [],
  })
  errors: Array<{ source: string; message: string }>;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  finishedAt: Date | null;
}

export const ScrapeRunSchema = SchemaFactory.createForClass(ScrapeRun);
