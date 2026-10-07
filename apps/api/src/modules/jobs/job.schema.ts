import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';

export type JobDocument = Job & Document;

@Schema({ timestamps: true, collection: 'jobs' })
export class Job {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  urlHash: string;

  @Prop({ required: true, index: true })
  sourceId: string;

  @Prop({ required: true })
  sourceName: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  company: string;

  @Prop({ default: '' })
  location: string;

  @Prop({ default: '' })
  country: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true, index: true })
  postedAt: Date;

  @Prop({ required: true })
  scrapedAt: Date;

  @Prop({ default: 'all' })
  experienceLevel: string;

  @Prop({ default: 'all' })
  remoteType: string;

  @Prop({ default: 'all' })
  jobType: string;

  @Prop({ type: Object, default: null })
  salary: Record<string, unknown> | null;

  @Prop({ type: [String], default: [] })
  skills: string[];

  @Prop({ default: 'external' })
  applyMethod: string;

  @Prop({ default: 0, index: true })
  matchScore: number;

  @Prop({ default: '' })
  matchReason: string;

  @Prop({ default: 'new', index: true })
  status: string;
}

export const JobSchema = SchemaFactory.createForClass(Job);

JobSchema.index({ userId: 1, urlHash: 1 }, { unique: true });
