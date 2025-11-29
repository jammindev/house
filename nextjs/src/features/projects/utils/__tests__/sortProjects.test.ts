import { sortProjectsByPinAndUpdate } from "../sortProjects";
import type { ProjectWithMetrics } from "@projects/types";

let counter = 1;
const buildProject = (overrides: Partial<ProjectWithMetrics> = {}): ProjectWithMetrics => ({
  id: overrides.id ?? `project-${counter++}`,
  household_id: "house-1",
  title: "Project",
  description: "",
  status: "draft",
  priority: 1,
  type: "other",
  start_date: null,
  due_date: null,
  closed_at: null,
  tags: [],
  planned_budget: 0,
  actual_cost_cached: 0,
  cover_interaction_id: null,
  project_group_id: null,
  is_pinned: false,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  created_by: null,
  updated_by: null,
  metrics: null,
  isOverdue: false,
  isDueSoon: false,
  group: null,
  ...overrides,
});

describe("sortProjectsByPinAndUpdate", () => {
  beforeEach(() => {
    counter = 1;
  });

  it("places pinned projects before unpinned ones", () => {
    const projects = [
      buildProject({ id: "unpinned-1" }),
      buildProject({ id: "pinned", is_pinned: true }),
      buildProject({ id: "unpinned-2" }),
    ];

    const sorted = sortProjectsByPinAndUpdate(projects);

    expect(sorted[0].id).toBe("pinned");
    expect(sorted.slice(1).map((p) => p.id)).toEqual(["unpinned-1", "unpinned-2"]);
  });

  it("falls back to updated_at when pin state matches", () => {
    const projects = [
      buildProject({ id: "older", updated_at: "2025-01-01T10:00:00.000Z" }),
      buildProject({ id: "newer", updated_at: "2025-01-02T10:00:00.000Z" }),
      buildProject({ id: "latest", updated_at: "2025-01-03T10:00:00.000Z" }),
    ];

    const sorted = sortProjectsByPinAndUpdate(projects);

    expect(sorted.map((p) => p.id)).toEqual(["latest", "newer", "older"]);
  });
});
