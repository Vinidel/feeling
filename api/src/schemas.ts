import { z } from "zod";

const activitiesSchema = z.object({
  bow: z.boolean().default(false),
  lift: z.boolean().default(false),
  run: z.boolean().default(false),
  cycle: z.boolean().default(false),
  swim: z.boolean().default(false),
}).strict();

const checksSchema = z.object({
  cardio: z.boolean().default(false),
  strength: z.boolean().default(false),
  mobility: z.boolean().default(false),
  build: z.boolean().default(false),
  archery: z.boolean().default(false),
  hunt: z.boolean().default(false),
}).strict();

const notesSchema = z.object({
  win: z.string().default(""),
  challenge: z.string().default(""),
  nextWeek: z.string().default(""),
}).strict();

const neutralActivities = {
  bow: false,
  lift: false,
  run: false,
  cycle: false,
  swim: false,
};

const neutralChecks = {
  cardio: false,
  strength: false,
  mobility: false,
  build: false,
  archery: false,
  hunt: false,
};

const neutralNotes = { win: "", challenge: "", nextWeek: "" };

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  (value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value;
  },
  "Invalid calendar date",
);

export const feelingRequestSchema = z.object({
  status: z.enum(["0", "1", "2", "3", "4"]),
  createdAt: z.iso.datetime({ offset: true }),
  comment: z.string().default(""),
  activities: activitiesSchema.default(neutralActivities),
}).strict();

export const weeklyTrackerRequestSchema = z.object({
  weekOf: dateOnlySchema,
  mood: z.enum(["rough", "low", "steady", "good", "great"]),
  trackerVersion: z.literal(1).default(1),
  checks: checksSchema.default(neutralChecks),
  notes: notesSchema.default(neutralNotes),
}).strict();

export const weeklyTrackerQuerySchema = z.object({
  weekOf: dateOnlySchema,
}).strict();

export type FeelingRequest = z.infer<typeof feelingRequestSchema>;
export type WeeklyTrackerRequest = z.infer<
  typeof weeklyTrackerRequestSchema
>;
