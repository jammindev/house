/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InsuranceContractStatusEnum } from './InsuranceContractStatusEnum';
import type { InsuranceContractTypeEnum } from './InsuranceContractTypeEnum';
import type { PaymentFrequencyEnum } from './PaymentFrequencyEnum';
export type PatchedInsuranceContract = {
    readonly id?: string;
    readonly household?: string;
    name?: string;
    provider?: string;
    contract_number?: string;
    type?: InsuranceContractTypeEnum;
    insured_item?: string;
    start_date?: string | null;
    end_date?: string | null;
    renewal_date?: string | null;
    status?: InsuranceContractStatusEnum;
    payment_frequency?: PaymentFrequencyEnum;
    monthly_cost?: string;
    yearly_cost?: string;
    coverage_summary?: string;
    notes?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
    readonly updated_by?: number | null;
};

