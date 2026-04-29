/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BlankEnum } from './BlankEnum';
import type { CurveTypeEnum } from './CurveTypeEnum';
import type { DeviceTypeEnum } from './DeviceTypeEnum';
import type { NullEnum } from './NullEnum';
import type { PhaseEnum } from './PhaseEnum';
import type { PoleCountEnum } from './PoleCountEnum';
import type { ProtectiveDeviceRoleEnum } from './ProtectiveDeviceRoleEnum';
import type { TypeCodeEnum } from './TypeCodeEnum';
/**
 * Base serializer with shared household validation helpers.
 */
export type ProtectiveDevice = {
    readonly id: string;
    readonly household: string;
    board: string;
    parent_rcd?: string | null;
    label?: string | null;
    device_type: DeviceTypeEnum;
    role?: (ProtectiveDeviceRoleEnum | BlankEnum | NullEnum) | null;
    row?: number | null;
    position?: number | null;
    position_end?: number | null;
    phase?: (PhaseEnum | BlankEnum | NullEnum) | null;
    rating_amps?: number | null;
    pole_count?: (PoleCountEnum | NullEnum) | null;
    curve_type?: (CurveTypeEnum | BlankEnum);
    sensitivity_ma?: number | null;
    type_code?: (TypeCodeEnum | BlankEnum);
    phase_coverage?: any;
    brand?: string;
    model_ref?: string;
    installed_at?: string | null;
    is_spare?: boolean;
    is_active?: boolean;
    notes?: string;
    readonly created_at: string;
    readonly updated_at: string;
};

