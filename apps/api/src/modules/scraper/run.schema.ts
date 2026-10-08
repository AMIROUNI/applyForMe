import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';
import type { ExtensionTaskStatus } from '@agency-apply/shared';

export type ScrapeRunDocument = ScrapeRun & Document;

@Schema({ _id: false })
export class ExtensionTaskRecord {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true, default: 'pending', type: String })
  status: ExtensionTaskStatus;

  @Prop({ default: '' })
  searchUrl: string;

  @Prop({ default: 0, min: 0 })
  pagesCaptured: number;

  @Prop({ default: 0, min: 0 })
  itemsFound: number;

  @Prop({ default: '' })
  message: string;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  finishedAt: Date | null;
}

export const ExtensionTaskRecordSchema = SchemaFactory.createForClass(ExtensionTaskRecord);

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

  @Prop({ type: [ExtensionTaskRecordSchema], default: [] })
  extensionTasks: ExtensionTaskRecord[];

  @Prop({ type: Date, default: null })
  startedAt: Date | null;

  @Prop({ type: Date, default: null })
  finishedAt: Date | null;
}

export const ScrapeRunSchema = SchemaFactory.createForClass(ScrapeRun);
