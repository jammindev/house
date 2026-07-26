/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Read serializer for an arbitration.
 *
 * Writes go through ``services.waive_finding``, never through this serializer:
 * creating a waiver requires re-running the detector (to prove the écart exists
 * and to capture its fingerprint), which is service work, not field validation.
 */
export type ComplianceWaiver = {
    readonly id: string;
    /**
     * Detector key from banking.compliance.REGISTRY.
     */
    readonly finding_kind: string;
    readonly object_id: string;
    /**
     * Why this écart is acceptable. Required: an arbitration without a motive is indistinguishable from hiding the problem.
     */
    readonly reason: string;
    /**
     * State of the écart when it was arbitrated. When it no longer matches, the waiver is stale and the écart resurfaces.
     */
    readonly fingerprint: string;
    readonly created_at: string;
    readonly created_by: number | null;
};

