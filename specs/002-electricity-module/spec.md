# Feature Specification: Electricity Module

**Feature Branch**: `002-electricity-module`  
**Created**: 2026-02-26  
**Status**: Draft  
**Input**: User description: "Create electricity module"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log electricity data (Priority: P1)

As a household member, I can record electricity readings and electricity bills so that I keep an up-to-date history of consumption and cost.

**Why this priority**: Without reliable data capture, no other electricity tracking value is possible.

**Independent Test**: Can be fully tested by creating readings and bills for one household and verifying they are saved, visible, and editable.

**Acceptance Scenarios**:

1. **Given** a member is in a household, **When** they add an electricity reading with date and meter value, **Then** the reading is stored and shown in the household electricity history.
2. **Given** a member is in a household, **When** they add an electricity bill with billing period and total amount, **Then** the bill is stored and shown in the household electricity history.
3. **Given** existing electricity entries, **When** a member updates an incorrect entry, **Then** the corrected values replace the previous values.

---

### User Story 2 - View monthly overview (Priority: P2)

As a household member, I can view monthly consumption and cost summaries so that I can quickly understand trends.

**Why this priority**: Summaries convert raw entries into actionable information for household decisions.

**Independent Test**: Can be tested with sample entries across multiple months and verifying monthly totals are correctly displayed.

**Acceptance Scenarios**:

1. **Given** electricity entries exist over several months, **When** a member opens the electricity overview, **Then** they see monthly total consumption and monthly total cost.
2. **Given** no electricity entries for a month, **When** that month is viewed, **Then** the system shows zero or empty-state values clearly.

---

### User Story 3 - Detect unusual changes (Priority: P3)

As a household member, I can see flagged unusual increases in consumption or cost so that I can investigate potential issues early.

**Why this priority**: Anomaly visibility helps avoid billing surprises and identify potential equipment or usage issues.

**Independent Test**: Can be tested by entering data with a clear spike and verifying the period is marked as unusual.

**Acceptance Scenarios**:

1. **Given** historical monthly data exists, **When** a new month exceeds the configured comparison threshold, **Then** the month is flagged as unusual in the overview.

### Edge Cases

- A first reading exists with no prior baseline; the system stores it but does not compute consumption from it alone.
- A reading date duplicates an existing reading date for the same household; the system rejects the duplicate with a clear message.
- A bill period overlaps an existing bill period; the system blocks overlap or requires explicit correction.
- A member tries to view or edit electricity data from a household they do not belong to; access is denied.
- Imported or entered values are negative or zero where not allowed; the system rejects invalid values and explains why.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow household members to create, view, update, and delete electricity readings for their household.
- **FR-002**: System MUST allow household members to create, view, update, and delete electricity bills for their household.
- **FR-003**: System MUST store, for each reading, at minimum the reading date, meter value, and household association.
- **FR-004**: System MUST store, for each bill, at minimum billing period start, billing period end, total amount, and household association.
- **FR-005**: System MUST prevent duplicate reading records for the same household on the same reading date.
- **FR-006**: System MUST validate that bill periods are valid date ranges and do not create unresolved overlaps within the same household.
- **FR-007**: System MUST provide a monthly overview that includes total consumption and total cost per month for a selected date range.
- **FR-008**: System MUST allow filtering electricity data by household and date range.
- **FR-009**: System MUST restrict electricity data access so that users can only access households where they are members.
- **FR-010**: System MUST flag unusual monthly increases in consumption or cost relative to recent historical values.

### Key Entities *(include if feature involves data)*

- **Electricity Reading**: A dated meter record tied to one household, used to calculate period consumption.
- **Electricity Bill**: A household utility charge for a defined billing period with total amount and optional notes.
- **Electricity Monthly Summary**: Aggregated monthly totals (consumption and cost), with optional anomaly flag.
- **Anomaly Rule**: Threshold definition used to determine whether a monthly value is unusual.

## Assumptions

- Electricity tracking is scoped to household-level data, not per individual member.
- Consumption calculations use sequential readings by date and ignore invalid gaps until corrected.
- Monthly summaries are calculated in calendar months.
- Users can correct historical data, and recalculated summaries reflect corrections.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of household members can create a reading or bill entry in under 60 seconds.
- **SC-002**: 100% of valid submitted reading and bill entries are reflected in overview data within 5 seconds.
- **SC-003**: At least 90% of tested monthly totals match expected consumption and cost values from known sample datasets.
- **SC-004**: At least 85% of users in pilot feedback report that the module helps them understand month-to-month electricity changes.
