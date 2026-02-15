// nextjs/src/features/projects/hooks/__tests__/useProjectsByGroup.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, MockedFunction } from "vitest";

import { createSPASassClientAuthenticated } from "@/lib/supabase/client";
import { useGlobal } from "@/lib/context/GlobalContext";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { fetchProjectsByGroup, useProjectsByGroup } from "../useProjects";
import type { Project, ProjectMetrics, ProjectWithMetrics } from "@projects/types";

// Mock dependencies
vi.mock("@/lib/supabase/client");
vi.mock("@/lib/context/GlobalContext");
vi.mock("@/lib/i18n/I18nProvider");
vi.mock("@projects/utils/projectFlags", () => ({
    computeProjectFlags: vi.fn().mockReturnValue({
        isOverdue: false,
        isDueSoon: false,
    }),
}));
vi.mock("@projects/utils/sortProjects", () => ({
    sortProjectsByPinAndUpdate: vi.fn((projects) => projects),
}));

const mockCreateSPASassClientAuthenticated = createSPASassClientAuthenticated as MockedFunction<
    typeof createSPASassClientAuthenticated
>;
const mockUseGlobal = useGlobal as MockedFunction<typeof useGlobal>;
const mockUseI18n = useI18n as MockedFunction<typeof useI18n>;

describe("fetchProjectsByGroup", () => {
    const mockSupabaseClient = {
        from: vi.fn(),
    };

    const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateSPASassClientAuthenticated.mockResolvedValue({
            getSupabaseClient: () => mockSupabaseClient,
        } as any);
        mockSupabaseClient.from.mockReturnValue(mockQuery);
    });

    it("should return empty array when householdId is null", async () => {
        const result = await fetchProjectsByGroup(null, "group-1");
        expect(result).toEqual([]);
    });

    it("should return empty array when householdId is undefined", async () => {
        const result = await fetchProjectsByGroup(undefined, "group-1");
        expect(result).toEqual([]);
    });

    it("should fetch projects without project group filter when projectGroupId is null", async () => {
        const mockProject: Project = {
            id: "project-1",
            household_id: "household-1",
            title: "Test Project",
            description: "Test Description",
            status: "active",
            priority: 1,
            type: "renovation",
            start_date: null,
            due_date: null,
            closed_at: null,
            tags: [],
            planned_budget: 1000,
            actual_cost_cached: 500,
            cover_interaction_id: null,
            project_group_id: null,
            is_pinned: false,
            project_group: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            created_by: "user-1",
            updated_by: "user-1",
        };

        mockQuery.select.mockResolvedValueOnce({ data: [mockProject], error: null });
        mockQuery.select.mockResolvedValueOnce({ data: [], error: null });
        mockQuery.select.mockResolvedValueOnce({ data: [], error: null });

        const result = await fetchProjectsByGroup("household-1", null);

        expect(mockSupabaseClient.from).toHaveBeenCalledWith("projects");
        expect(mockQuery.eq).toHaveBeenCalledWith("household_id", "household-1");
        expect(mockQuery.eq).not.toHaveBeenCalledWith("project_group_id", expect.anything());
        expect(result).toHaveLength(1);
    });

    it("should fetch projects with project group filter when projectGroupId is provided", async () => {
        const mockProject: Project = {
            id: "project-1",
            household_id: "household-1",
            title: "Test Project",
            description: "Test Description",
            status: "active",
            priority: 1,
            type: "renovation",
            start_date: null,
            due_date: null,
            closed_at: null,
            tags: [],
            planned_budget: 1000,
            actual_cost_cached: 500,
            cover_interaction_id: null,
            project_group_id: "group-1",
            is_pinned: false,
            project_group: { id: "group-1", name: "Test Group" },
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            created_by: "user-1",
            updated_by: "user-1",
        };

        const mockMetrics: ProjectMetrics = {
            project_id: "project-1",
            open_todos: 3,
            done_todos: 2,
            documents_count: 5,
            actual_cost: 500,
        };

        mockQuery.select.mockResolvedValueOnce({ data: [mockProject], error: null });
        mockQuery.select.mockResolvedValueOnce({ data: [mockMetrics], error: null });
        mockQuery.select.mockResolvedValueOnce({ data: [{ group_id: "group-1", projects_count: 1 }], error: null });

        const result = await fetchProjectsByGroup("household-1", "group-1");

        expect(mockQuery.eq).toHaveBeenCalledWith("household_id", "household-1");
        expect(mockQuery.eq).toHaveBeenCalledWith("project_group_id", "group-1");
        expect(result).toHaveLength(1);
        expect(result[0].metrics).toEqual(mockMetrics);
        expect(result[0].group).toEqual({ id: "group-1", name: "Test Group", projectsCount: 1 });
    });

    it("should handle Supabase errors", async () => {
        mockQuery.select.mockResolvedValueOnce({ data: null, error: { message: "Database error" } });

        await expect(fetchProjectsByGroup("household-1", "group-1")).rejects.toEqual({
            message: "Database error",
        });
    });

    it("should handle metrics fetch errors", async () => {
        const mockProject: Project = {
            id: "project-1",
            household_id: "household-1",
            title: "Test Project",
            description: "Test Description",
            status: "active",
            priority: 1,
            type: "renovation",
            start_date: null,
            due_date: null,
            closed_at: null,
            tags: [],
            planned_budget: 1000,
            actual_cost_cached: 500,
            cover_interaction_id: null,
            project_group_id: "group-1",
            is_pinned: false,
            project_group: null,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
            created_by: "user-1",
            updated_by: "user-1",
        };

        mockQuery.select.mockResolvedValueOnce({ data: [mockProject], error: null });
        mockQuery.select.mockResolvedValueOnce({ data: null, error: { message: "Metrics error" } });

        await expect(fetchProjectsByGroup("household-1", "group-1")).rejects.toEqual({
            message: "Metrics error",
        });
    });
});

describe("useProjectsByGroup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseGlobal.mockReturnValue({
            selectedHouseholdId: "household-1",
        } as any);
        mockUseI18n.mockReturnValue({
            t: vi.fn((key: string) => key),
        } as any);
    });

    it("should return loading state initially", () => {
        const { result } = renderHook(() => useProjectsByGroup("group-1"));

        expect(result.current.loading).toBe(true);
        expect(result.current.projects).toEqual([]);
        expect(result.current.error).toBe(null);
    });

    it("should set loading to false when no household or group id", async () => {
        mockUseGlobal.mockReturnValue({
            selectedHouseholdId: null,
        } as any);

        const { result } = renderHook(() => useProjectsByGroup("group-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.projects).toEqual([]);
        expect(result.current.error).toBe(null);
    });

    it("should set loading to false when no group id", async () => {
        const { result } = renderHook(() => useProjectsByGroup(null));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.projects).toEqual([]);
        expect(result.current.error).toBe(null);
    });

    it("should fetch projects successfully", async () => {
        const mockProjects: ProjectWithMetrics[] = [
            {
                id: "project-1",
                household_id: "household-1",
                title: "Test Project",
                description: "Test Description",
                status: "active",
                priority: 1,
                type: "renovation",
                start_date: null,
                due_date: null,
                closed_at: null,
                tags: [],
                planned_budget: 1000,
                actual_cost_cached: 500,
                cover_interaction_id: null,
                project_group_id: "group-1",
                is_pinned: false,
                project_group: null,
                created_at: "2024-01-01T00:00:00Z",
                updated_at: "2024-01-01T00:00:00Z",
                created_by: "user-1",
                updated_by: "user-1",
                metrics: null,
                isOverdue: false,
                isDueSoon: false,
                group: null,
            },
        ];

        // Mock the fetchProjectsByGroup function
        vi.doMock("../useProjects", async () => {
            const actual = await vi.importActual("../useProjects");
            return {
                ...actual,
                fetchProjectsByGroup: vi.fn().mockResolvedValue(mockProjects),
            };
        });

        const { result } = renderHook(() => useProjectsByGroup("group-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.projects).toEqual(mockProjects);
        expect(result.current.error).toBe(null);
    });

    it("should handle fetch errors", async () => {
        // Mock the fetchProjectsByGroup function to throw an error
        vi.doMock("../useProjects", async () => {
            const actual = await vi.importActual("../useProjects");
            return {
                ...actual,
                fetchProjectsByGroup: vi.fn().mockRejectedValue(new Error("Fetch error")),
            };
        });

        const { result } = renderHook(() => useProjectsByGroup("group-1"));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.projects).toEqual([]);
        expect(result.current.error).toBe("Fetch error");
    });

    it("should provide a reload function", async () => {
        const { result } = renderHook(() => useProjectsByGroup("group-1"));

        expect(typeof result.current.reload).toBe("function");

        // Test that reload can be called without errors
        await waitFor(() => {
            result.current.reload();
        });
    });
});