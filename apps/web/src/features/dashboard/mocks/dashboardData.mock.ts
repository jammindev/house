import { createInitialDashboardState } from "../utils/state";
import type { DashboardDocumentItem, DashboardState } from "../types";

const base = createInitialDashboardState();

const mockDocuments: DashboardDocumentItem[] = [
  {
    id: "document-1",
    household_id: "household-1",
    file_path: "household-1/interaction-1/invoice.pdf",
    name: "Roof Inspection Invoice",
    notes: "Paid in full",
    mime_type: "application/pdf",
    type: "invoice",
    metadata: { amount: 250 },
    created_at: new Date().toISOString(),
    created_by: "user-1",
    interaction_id: "interaction-1",
    link_role: null,
    link_note: null,
    link_created_at: null,
    links: [
      {
        interactionId: "interaction-1",
        subject: "Inspect roof leak",
      },
    ],
    hasLinks: true,
  },
  {
    id: "document-2",
    household_id: "household-1",
    file_path: "household-1/misc/manual.pdf",
    name: "Boiler Manual",
    notes: "",
    mime_type: "application/pdf",
    type: "document",
    metadata: {},
    created_at: new Date().toISOString(),
    created_by: "user-1",
    interaction_id: null,
    link_role: null,
    link_note: null,
    link_created_at: null,
    links: [],
    hasLinks: false,
  },
];

export const dashboardDataMock: DashboardState = {
  ...base,
  summary: [
    {
      key: "interactions",
      total: 42,
      labelKey: "dashboard.interactions",
      descriptionKey: "dashboard.totalInHousehold",
    },
    {
      key: "contacts",
      total: 18,
      labelKey: "dashboard.contacts",
      descriptionKey: "dashboard.peopleAndVendors",
    },
    {
      key: "zones",
      total: 9,
      labelKey: "dashboard.zones",
      descriptionKey: "dashboard.roomsAndAreas",
    },
  ],
  recentInteractions: {
    total: 42,
    items: [
      {
        id: "interaction-1",
        subject: "Inspect roof leak",
        content: "Called ACME Roofing to schedule inspection.",
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        type: "call",
      },
      {
        id: "interaction-2",
        subject: "Delivered new dishwasher",
        content: "Appliance delivered and installed successfully.",
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        type: "note",
      },
    ],
  },
  todos: [
    {
      id: "todo-1",
      subject: "Schedule annual HVAC maintenance",
      status: "pending",
      occurredAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      isOverdue: false,
      isDueSoon: true,
    },
    {
      id: "todo-2",
      subject: "Renew home insurance policy",
      status: "in_progress",
      occurredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      isOverdue: true,
      isDueSoon: false,
    },
  ],
  projects: [
    {
      id: "project-1",
      household_id: "household-1",
      title: "Kitchen refresh",
      description: "Paint cabinets and replace backsplash.",
      status: "active",
      priority: 3,
      start_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      closed_at: null,
      tags: ["kitchen"],
      planned_budget: 12000,
      actual_cost_cached: 2500,
      cover_interaction_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: "user-1",
      updated_by: "user-1",
      metrics: {
        project_id: "project-1",
        open_todos: 2,
        done_todos: 1,
        documents_count: 4,
        actual_cost: 2500,
      },
      isOverdue: false,
      isDueSoon: true,
    },
  ],
  documents: {
    items: mockDocuments,
    unlinkedCount: mockDocuments.filter((doc) => !doc.hasLinks).length,
  },
};
