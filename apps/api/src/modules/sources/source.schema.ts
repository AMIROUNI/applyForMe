import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { Document } from 'mongoose';
import type {
  SourceAddedBy,
  SourceExecutionMode,
  SourceStatus,
  SourceType,
} from '@agency-apply/shared';

export type JobSourceDocument = JobSource & Document;

export interface SourceHealthRecord {
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  failureCount: number;
  avgLatencyMs: number | null;
}

export const emptyHealth = (): SourceHealthRecord => ({
  lastSuccessAt: null,
  lastErrorAt: null,
  failureCount: 0,
  avgLatencyMs: null,
});

/**
 * A curated job source. `_id`/`id` virtuals are disabled so the stable slug
 * (`remotive`, `linkedin`, ...) is the primary key — scrape runs reference it.
 */
@Schema({ timestamps: true, collection: 'job_sources', _id: false, id: false })
export class JobSource {
  @Prop({ required: true, unique: true, index: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  baseUrl: string;

  @Prop({ required: true, index: true, type: String })
  type: SourceType;

  @Prop({ type: [String], default: [], index: true })
  countries: string[];

  @Prop({ type: [String], default: [] })
  categories: string[];

  @Prop({ default: true })
  remoteFriendly: boolean;

  @Prop({ required: true, default: 'pending', index: true, type: String })
  status: SourceStatus;

  @Prop({ type: Object, default: {} })
  config: Record<string, unknown>;

  @Prop({ default: false })
  requiresUserToken: boolean;

  /** Where the source runs: on our servers, or in the user's own browser. */
  @Prop({ required: true, default: 'server', index: true, type: String })
  executionMode: SourceExecutionMode;

  /** True when the source can only be collected through the browser extension. */
  @Prop({ default: false, index: true })
  requiresExtension: boolean;

  @Prop({
    type: {
      lastSuccessAt: Date,
      lastErrorAt: Date,
      failureCount: Number,
      avgLatencyMs: Number,
    },
    default: () => emptyHealth(),
  })
  health: SourceHealthRecord;

  @Prop({ required: true, default: 'system', index: true, type: String })
  addedBy: SourceAddedBy;

  @Prop({ type: String, default: null, index: true })
  ownerId: string | null;
}

export const JobSourceSchema = SchemaFactory.createForClass(JobSource);

JobSourceSchema.index({ status: 1, type: 1 });
JobSourceSchema.index({ ownerId: 1, addedBy: 1 });
