import { z } from "zod";

/**
 * Zod validation schemas for project forms
 * Used with react-hook-form via @hookform/resolvers/zod
 */

export const projectDetailsSchema = z.object({
  description: z.string().optional(),
  status: z.enum(["draft", "active", "on_hold", "completed", "cancelled"]),
  priority: z.number().int().min(1).max(5),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()),
  plannedBudget: z.number().positive().optional().or(z.nan()),
  zoneIds: z.array(z.string().uuid()).min(1, { message: "projects.wizard.zonesRequired" }),
});

export type ProjectDetailsFormData = z.infer<typeof projectDetailsSchema>;
