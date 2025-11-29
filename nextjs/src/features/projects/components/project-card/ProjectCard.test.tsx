import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import ProjectCard from "./ProjectCard";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { ProjectWithMetrics } from "@projects/types";

vi.mock("@/components/layout/LinkWithOverlay", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="link-mock">{children}</div>,
}));

const useProjectMock = vi.fn(() => ({ interactionsCount: 4 }));
vi.mock("@projects/hooks/useProject", () => ({
  useProject: () => useProjectMock(),
}));

const BASE_PROJECT: ProjectWithMetrics = {
  id: "project-1",
  household_id: "household-1",
  title: "Kitchen Refresh",
  description: "Replace cabinets and repaint the ceiling.",
  status: "draft",
  priority: 3,
  type: "renovation",
  start_date: "2025-01-05T00:00:00.000Z",
  due_date: "2025-01-20T00:00:00.000Z",
  closed_at: null,
  tags: ["paint"],
  planned_budget: 5000,
  actual_cost_cached: 1200,
  cover_interaction_id: null,
  project_group_id: null,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-02T00:00:00.000Z",
  created_by: "user-1",
  updated_by: "user-1",
  metrics: {
    project_id: "project-1",
    open_todos: 2,
    done_todos: 1,
    documents_count: 3,
    actual_cost: 1200,
  },
  isOverdue: false,
  isDueSoon: true,
  group: null,
};

const renderProjectCard = (overrides: Partial<ProjectWithMetrics> = {}) => {
  const project = { ...BASE_PROJECT, ...overrides };
  return {
    project,
    ...render(
      <I18nProvider initialLocale="en">
        <ProjectCard project={project} />
      </I18nProvider>
    ),
  };
};

describe("ProjectCard", () => {
  beforeEach(() => {
    useProjectMock.mockReturnValue({ interactionsCount: 4 });
  });

  it("renders project metadata and the type badge", () => {
    renderProjectCard();

    expect(screen.getByRole("heading", { name: BASE_PROJECT.title })).toBeInTheDocument();
    expect(screen.getByText("Renovation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /more details/i })).toBeInTheDocument();
  });

  it("toggles the details section using the footer control", () => {
    const { project } = renderProjectCard();
    const detailsId = `project-card-details-${project.id}`;
    const details = document.getElementById(detailsId);
    expect(details).not.toBeNull();
    expect(details).toHaveAttribute("hidden");

    const toggleButton = screen.getByRole("button", { name: /more details/i });
    fireEvent.click(toggleButton);

    expect(details).not.toHaveAttribute("hidden");
    expect(screen.getByText(project.description)).toBeVisible();
    expect(screen.getByRole("button", { name: /hide details/i })).toBeInTheDocument();
  });

  it("applies the type accent classes to the footer toggle", () => {
    renderProjectCard();
    const renovationToggle = screen.getByRole("button", { name: /more details/i });
    expect(renovationToggle).toHaveClass("bg-amber-50");
    expect(renovationToggle).toHaveClass("border-amber-200");

    // Re-render with another project type to ensure the classes change accordingly.
    renderProjectCard({ type: "repair" });
    const repairToggle = screen.getAllByRole("button", { name: /more details/i }).at(-1);
    expect(repairToggle).toHaveClass("bg-rose-50");
    expect(repairToggle).toHaveClass("border-rose-200");
  });
});
