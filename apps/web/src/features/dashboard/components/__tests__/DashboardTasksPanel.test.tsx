import { render, screen } from "@testing-library/react";
import React from "react";

import { I18nProvider } from "@/lib/i18n/I18nProvider";

import DashboardTasksPanel from "../DashboardTasksPanel";
import type { DashboardTask } from "@dashboard/types";

describe("DashboardTasksPanel", () => {
  const renderComponent = (tasks: DashboardTask[], loading = false) =>
    render(
      <I18nProvider initialLocale="en">
        <DashboardTasksPanel tasks={tasks} loading={loading} />
      </I18nProvider>
    );

  it("shows a list of tasks with metadata", () => {
    const tasks: DashboardTask[] = [
      {
        id: "1",
        subject: "Repair kitchen sink",
        status: "pending",
        occurred_at: "2025-01-01T00:00:00.000Z",
        created_at: "2024-12-15T00:00:00.000Z",
        project: { id: "p1", title: "Kitchen refresh", status: "active" },
      },
    ];

    renderComponent(tasks);

    expect(screen.getByText("Repair kitchen sink")).toBeInTheDocument();
    expect(screen.getByText(/Due/)).toBeInTheDocument();
    expect(screen.getByText("Kitchen refresh")).toBeInTheDocument();
  });

  it("renders empty state when no tasks", () => {
    renderComponent([]);
    expect(screen.getByText("You have no upcoming tasks.")).toBeInTheDocument();
  });

  it("renders skeletons while loading", () => {
    renderComponent([], true);
    expect(screen.getByTestId("tasks-loading")).toBeInTheDocument();
  });
});
