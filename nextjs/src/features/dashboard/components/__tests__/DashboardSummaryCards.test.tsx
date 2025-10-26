import { render, screen } from "@testing-library/react";
import React from "react";

import { I18nProvider } from "@/lib/i18n/I18nProvider";

import DashboardSummaryCards from "../DashboardSummaryCards";

describe("DashboardSummaryCards", () => {
  const renderComponent = (summary = null, loading = false) =>
    render(
      <I18nProvider initialLocale="en">
        <DashboardSummaryCards summary={summary} loading={loading} />
      </I18nProvider>
    );

  it("displays metrics and action links", () => {
    renderComponent({ interactions: 12, contacts: 4, zones: 6, documents: 9 });

    expect(screen.getByText("Household overview")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New interaction" })).toHaveAttribute(
      "href",
      "/app/interactions/new"
    );
    expect(screen.getByRole("link", { name: "Invite a member" })).toHaveAttribute(
      "href",
      "/app/households"
    );
  });

  it("renders skeletons while loading", () => {
    renderComponent(null, true);
    expect(screen.getByTestId("summary-skeleton-interactions")).toBeInTheDocument();
    expect(screen.getByTestId("summary-skeleton-documents")).toBeInTheDocument();
  });
});
