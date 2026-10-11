# Project Plan Document

**Project name:** Talebe Uyarlanabilir Envanter ve Anlık Sipariş Karşılama Sistemi

**Document version:** 0.1 (Initial draft)

**Date:** 11 October 2026

## Document Contributors

| Full name | Student number | Contribution to this document |
| --- | --- | --- |
| Ömer Kılınç | 261111011 | Preparation of the initial project plan, including organization, schedule, resources, risks, communication, change management, effort estimates, and acceptance planning. |

## Table of Contents

1. [Project Scope](#1-project-scope)
2. [Project Organization](#2-project-organization)
3. [Project Execution and Management Objectives](#3-project-execution-and-management-objectives)
4. [Key Phases and Timeline](#4-key-phases-and-timeline)
5. [Resource Planning](#5-resource-planning)
6. [Risk Management](#6-risk-management)
7. [Communication Plan](#7-communication-plan)
8. [Change Management Plan](#8-change-management-plan)
9. [Budget and Effort Plan](#9-budget-and-effort-plan)
10. [Acceptance Tests and Acceptance Criteria](#10-acceptance-tests-and-acceptance-criteria)
11. [Document Task Matrix](#11-document-task-matrix)

## 1. Project Scope

This plan supports the scope and success criteria in the [Project Definition Document](../1-Project%20Definition%20Document/project-definition.md). The schedule, workload, and responsibility allocation are provisional estimates to be confirmed by the team.

### 1.1 Included in Scope

- One organization, one shared inventory, and Viewer, Operator, and Administrator staff roles.
- Management of product types and unique digital items, with encrypted code storage and lifecycle tracking.
- Minimal customer records containing an ID, creation and update timestamps, and an optional email address.
- Assignment of available items to customers, with each item assignable only once, including during simultaneous requests.
- Permanent item records and separate assignment records preserving the recipient, responsible staff member, and assignment time.
- A FastAPI backend and React dashboard for inventory, customer, and assignment operations.
- Background replenishment driven by demand frequency, demand quantity, and stock levels.
- Two simulated supplier implementations using synthetic digital codes.
- Explicit application of Strategy, Adapter, and State in the business logic.
- Tests, setup instructions, project documentation, and a local demonstration.

Fulfillment is complete when an item is assigned and its code is available to authorized staff. Assigned items remain in the database and are excluded from available stock.

### 1.2 Excluded from Scope

- Payment processing.
- Customer accounts, customer authentication, and direct customer access to the API or dashboard.
- Multiple organizations, separate user inventories, and inventory cloning or splitting.
- Automatic email delivery in the initial version.
- Live supplier purchases in the initial demonstration.

## 2. Project Organization

The following development responsibilities are proposed. They are separate from the application's user roles and do not establish document authorship.

| Team member | Role | Responsibilities |
| --- | --- | --- |
| Ömer Kılınç (261111011) | Core backend and data lead | Database design, inventory and assignment logic, core API, encrypted item storage, and the State pattern. |
| Deren Berk (221101068) | Dashboard and access-control lead | React dashboard, staff authentication, API permission checks, and frontend/backend integration. |
| Hasan Yiğit Sarı (231101050) | Replenishment and supplier-integration lead | Demand analysis, replenishment policies, background processing, simulated suppliers, and the Strategy and Adapter patterns. |

Each member writes tests and documentation for their work, contributes through their own GitHub account, and reviews another member's changes. All members should be able to explain and demonstrate the complete system. Responsibilities and workload will be reviewed weekly.

## 3. Project Execution and Management Objectives

| Objective ID | Objective | Completion measure |
| --- | --- | --- |
| PM-01 | Deliver working functionality incrementally. | Each milestone has a reviewable outcome and an updated GitHub issue or pull request. |
| PM-02 | Maintain traceability from requirements to implementation and tests. | The four selected core use cases have consistent identifiers and links to relevant components, patterns, and acceptance tests. |
| PM-03 | Keep individual contributions visible and reviewed. | Contributions use each member's own account, and changes receive review from another member before merging. |
| PM-04 | Control scope and workload. | Weekly check-ins update progress, effort estimates, risks, and any approved scope changes. |
| PM-05 | Prepare a reproducible demonstration and shared understanding. | Another team member can run the system from the setup instructions, and every member can explain its main flows and pattern choices. |

## 4. Key Phases and Timeline

### 4.1 Phases, Delivery Dates, and Deliverables

The confirmed PA-1 deadline is **11 October 2026 at 23:59, Europe/Istanbul**. Dates after PA-1 are proposed internal targets, not announced course deadlines. PA-2, PA-3, and final demonstration dates must be reconciled with instructor announcements.

The six-week development estimate covers 12 October through 22 November 2026. Testing and documentation accompany development throughout; the dedicated testing phase consolidates acceptance evidence.

| Phase | Start date | End date | Deliverables | Delivery date | Responsible member |
| --- | --- | --- | --- | --- | --- |
| PA-1 planning and design package | 11 October 2026 | 11 October 2026 | Three required documents, including four core use cases, architecture overview, and pattern mappings. | 11 October 2026, 23:59 | All members; actual authorship recorded in each document. |
| Architecture and foundation | 12 October 2026 | 18 October 2026 | Agreed data model and API contracts, project setup, frontend choice, authentication approach, and authentication foundation. | 18 October 2026 | Ömer: data/API; Deren: frontend/authentication; Hasan: supplier/replenishment design. |
| Core inventory and assignments | 19 October 2026 | 25 October 2026 | Item imports, customer records, encrypted storage, assignments, initial tests, and a basic dashboard. | 25 October 2026 | Ömer and Deren; Hasan supports integration and review. |
| Suppliers and replenishment | 26 October 2026 | 1 November 2026 | Two supplier adapters, background processing, selected replenishment policy, and controlled demand scenarios. | 1 November 2026 | Hasan; Ömer and Deren integrate API and dashboard support. |
| Complete integration | 2 November 2026 | 8 November 2026 | Complete dashboard, role enforcement, and integrated inventory-to-replenishment flows. | 8 November 2026 | Deren coordinates frontend integration; all members complete their components. |
| Acceptance testing and documentation | 9 November 2026 | 15 November 2026 | Recorded acceptance and concurrency test results, updated documentation, setup instructions, and a defect list. | 15 November 2026 | All members test their components and review another member's work. |
| Fixes, final review, and demonstration preparation | 16 November 2026 | 22 November 2026 | Required fixes, final acceptance evidence, reviewed documents, and a rehearsed local demonstration. | 22 November 2026 | All members. |

### 4.2 Milestones and Dependencies

| Milestone | Target date | Dependencies | Completion condition |
| --- | --- | --- | --- |
| M-01: PA-1 package ready | 11 October 2026 | Agreed scope and preparation of the three documents. | Required content and contribution records are reviewed and the submission package is accessible to the instructor. |
| M-02: Development foundation ready | 18 October 2026 | PA-1 design and team agreement on open technical decisions. | Shared setup works; schema, API contracts, frontend framework, and authentication approach are recorded. |
| M-03: First complete assignment flow | 25 October 2026 | M-02, item storage, and customer management. | Authorized staff can import an item, assign it, and inspect the resulting stock and history through the basic dashboard. |
| M-04: Replenishment demonstration ready | 1 November 2026 | M-03 stock changes, selected policy, and supplier adapters. | Controlled demand scenarios trigger the expected replenishment behavior through the simulated suppliers. |
| M-05: Integrated application ready | 8 November 2026 | M-03 and M-04. | Dashboard, API, permissions, database, and worker operate together. |
| M-06: Acceptance evidence ready | 15 November 2026 | M-05 and defined expected results. | Planned tests have recorded outcomes; failures are tracked and documentation reflects the implementation. |
| M-07: Internal project completion | 22 November 2026 | M-06 and resolution of failures affecting required acceptance criteria. | Acceptance criteria pass, remaining limitations are documented, and the team can run and explain the demonstration. |

### 4.3 Project Closure and Evaluation

**Project closure date:** 22 November 2026, proposed internal target.

**Project evaluation date:** 22 November 2026, after the internal demonstration; subject to the official course schedule.

**Closure activities:** Review acceptance results, resolve failures affecting the required scope, document remaining limitations, finalize setup instructions and contribution records, and prepare the final demonstration package.

**Evaluation method:** Compare recorded results with the Project Definition Document's success criteria, review requirement and pattern traceability, and have each member explain their work and the complete system.

## 5. Resource Planning

| Resource | Purpose | Access or acquisition method | Responsible member |
| --- | --- | --- | --- |
| Existing team computers | Local development, testing, and demonstration. | Use existing equipment; document the common setup. | Each member. |
| GitHub repository | Source control, contribution history, issues, and reviews. | Use the existing shared repository and individual accounts. | All members. |
| Python and FastAPI | Backend API and business logic. | Install dependencies locally and record compatible versions in the repository. | Ömer Kılınç. |
| PostgreSQL | Store users, customers, items, assignments, and replenishment records. | Run local development/test instances with documented setup and synthetic data. | Ömer Kılınç. |
| React with Vite or Next.js | Staff dashboard. | Select the frontend framework during the foundation phase and record the decision. React with Vite is the initial preference. | Deren Berk. |
| Authentication and encryption libraries | Staff access and protection of stored codes. | Select maintained libraries during the foundation phase; keep real keys and credentials outside Git. | Deren Berk: authentication; Ömer Kılınç: encryption. |
| Python background worker | Evaluate stock and demand and perform replenishment. | Run a separate local process from the backend codebase. | Hasan Yiğit Sarı. |
| Two simulated suppliers | Demonstrate different supplier interfaces and controlled failures. | Implement local simulators that return synthetic codes. | Hasan Yiğit Sarı. |
| Test tools and Markdown documents | Automated checks, acceptance evidence, and project documentation. | Keep test code and documents in GitHub; record reproducible commands and sanitized results. | All members. |

The authentication mechanism, exact replenishment algorithm, detailed lifecycle states, and out-of-stock behavior will be specified during design. The doubling/halving approach remains a candidate policy.

## 6. Risk Management

Likelihood and impact are initial qualitative estimates and will be revisited during weekly check-ins.

| Risk ID | Risk | Likelihood | Impact | Mitigation | Responsible member |
| --- | --- | --- | --- | --- | --- |
| R-01 | Simultaneous requests assign the same item more than once. | Medium | High | Enforce assignment uniqueness and atomic updates; test concurrent requests and failed operations. | Ömer Kılınç. |
| R-02 | Codes or credentials are exposed, or a role can perform unauthorized operations. | Medium | High | Encrypt codes, separate secret configuration from Git, enforce permissions in the API, and test access boundaries. | Ömer Kılınç and Deren Berk. |
| R-03 | Replenishment overreacts to demand changes or fails to maintain the intended stock level. | Medium | High | Define stock limits and expected policy behavior; test low, high, and changing demand with synthetic scenarios before integration. | Hasan Yiğit Sarı. |
| R-04 | Supplier errors leave stock inconsistent or lead to duplicate imports. | Medium | High | Simulate failures and repeated responses, record failed work, and define controlled retry and duplicate-handling behavior. | Hasan Yiğit Sarı. |
| R-05 | Frontend and backend expectations diverge or integration starts too late. | Medium | Medium | Agree API contracts in the first week and demonstrate the first complete assignment flow in the second week. | Deren Berk and Ömer Kılınç. |
| R-06 | Limited availability, learning effort, or scope growth delays delivery. | Medium | High | Review capacity weekly, redistribute tasks, keep optional features outside the initial scope, and use the reserved rework time. | All members. |

## 7. Communication Plan

### 7.1 Team Communication

| Activity | Participants | Channel | Frequency | Record or output |
| --- | --- | --- | --- | --- |
| Planning and progress check-in | All members. | Team-selected meeting/call channel; choose the recurring time and channel at the first check-in. | Weekly. | GitHub issue updates covering progress, next tasks, risks, and changed estimates. |
| Task coordination and blockers | Relevant task owners and reviewers. | GitHub issues; a team chat channel may supplement them once selected. | As work progresses; raise blocking issues promptly. | Named owner, next action, and any revised target date. |
| Change review | Change author and at least one other member. | GitHub pull requests. | Before merging changes. | Review comments and the resulting merge or revision decision. |
| Milestone demonstration | All members. | Local demonstration or screen-sharing session. | At each milestone. | Brief result, defects, and follow-up tasks recorded in GitHub. |

### 7.2 Stakeholder Communication

| Stakeholder | Purpose | Channel | Frequency | Responsible member |
| --- | --- | --- | --- | --- |
| Course instructor | Clarify requirements, assessment expectations, and later deadlines. | Instructor-designated course communication channel. | When clarification is needed or new instructions are announced. | Ömer Kılınç as proposed contact; all members review the response. |
| Course instructor | Receive assignment documents and inspect contribution evidence. | Google Drive submission folder according to the announcement, with GitHub contribution evidence and access as required. | At each confirmed assignment deadline. | Ömer Kılınç as proposed submission coordinator; all members review the package. |

Contact and submission responsibilities are planning assignments. No communication or submission is claimed to have occurred.

## 8. Change Management Plan

### 8.1 Change Request Process

Record proposed scope, behavior, architecture, or schedule changes in a GitHub issue. Describe the reason, affected requirements or documents, and the intended outcome. Small corrections may be described directly in a pull request.

### 8.2 Impact Assessment

The affected component owners estimate the effect on effort, deadlines, data handling, interfaces, tests, and pattern mappings. Identify dependencies and whether the change fits within the remaining capacity.

### 8.3 Review and Approval

The team agrees on changes affecting scope, milestones, or shared contracts before implementation. Another member reviews implementation changes before merging. Record accepted, deferred, or rejected decisions and their reasons in the issue or pull request.

### 8.4 Documentation and Version Updates

Update affected documents, acceptance tests, and task estimates with the implementation. Preserve stable identifiers where possible, update the document version/date for substantive revisions, and link relevant issues, commits, and pull requests.

## 9. Budget and Effort Plan

### 9.1 Effort Allocation

The working capacity assumption is **8 hours per member per week for 6 weeks**, giving **48 hours per member and 144 person-hours in total**. This forward estimate covers 12 October through 22 November and excludes time already spent preparing PA-1.

The allocation reserves 120 person-hours for planned work and 24 person-hours for rework and final review. Members will confirm availability and revise estimates during weekly check-ins.

| Phase or task | Responsible member | Estimated effort | Effort unit |
| --- | --- | --- | --- |
| Database, encrypted inventory, assignments, core API, State pattern, and component tests | Ömer Kılınç | 32 | Person-hours |
| Dashboard, authentication, permissions, interface integration, and component tests | Deren Berk | 32 | Person-hours |
| Demand policy, background processing, supplier adapters, and component tests | Hasan Yiğit Sarı | 32 | Person-hours |
| Shared architecture, reviews, acceptance testing, and documentation | All members, 8 hours each | 24 | Person-hours |
| Reserved rework, final review, and demonstration preparation | All members, 8 hours each | 24 | Person-hours |

**Total estimated effort:** 144 person-hours: 120 planned and 24 reserved. Each member's provisional allocation is 48 hours.

### 9.2 Resource and Cost Allocation

This estimate concerns additional cash spending. It assumes existing equipment, local execution, the existing repository, and no paid supplier purchases or hosted services. Development effort is reported separately and is not converted into a monetary cost.

| Resource | Related phase or task | Quantity | Estimated cost | Currency |
| --- | --- | --- | --- | --- |
| Existing computers | All phases | 3 existing devices | 0 additional spending | TRY |
| Local development tools and database | Development and testing | 3 development environments | 0 planned spending | TRY |
| Existing GitHub repository | Collaboration and documentation | 1 repository | 0 additional spending | TRY |
| Simulated suppliers and synthetic codes | Replenishment development and testing | 2 simulators | 0 external purchase cost | TRY |
| Local demonstration environment | Integration and demonstration | 1 demonstration setup | 0 additional spending | TRY |

**Total estimated cost:** 0 TRY in planned additional cash spending under these assumptions. Any paid service or purchase requires a revised estimate through the change process.

## 10. Acceptance Tests and Acceptance Criteria

### 10.1 Acceptance Test Plan

**Test environment:** A local FastAPI application, PostgreSQL test database, React dashboard, background worker, and two simulated supplier interfaces. Record dependency versions and configuration needed to reproduce each run.

**Test data:** Synthetic product types, unique test codes, minimal customer records, staff accounts for all three roles, controlled demand histories, and supplier responses including failures.

**Responsible members:** Ömer leads data and assignment tests; Deren leads dashboard and permission tests; Hasan leads replenishment and supplier tests. Each member reviews another member's results.

**Evidence to record:** Test case ID, execution date, tested commit, setup, expected and actual results, pass/fail status, and linked defects. Use sanitized logs and record summaries without credentials or usable digital codes.

The references below use feature and success-criterion IDs from the Project Definition Document. Add the corresponding use-case and requirement IDs once the Software Requirements Document defines them. **All tests below are planned and have not yet been executed.**

| Test ID | Related use case or requirement | Preconditions | Test steps | Expected result |
| --- | --- | --- | --- | --- |
| AT-01 | FEAT-01, FEAT-02; SC-04 | An authorized operator and a product with a known stock count. | Import three unique synthetic items; inspect item records and available stock. | Three distinct available items are added, and the available count increases by three. |
| AT-02 | FEAT-03, FEAT-04, FEAT-05; SC-01, SC-04 | An operator, available stock, and a test customer created with or without email. | Assign one item; inspect the customer link, staff identity, timestamp, item status, and history; retrieve the assigned code. | Exactly one item is assigned, available stock decreases by one, and authorized retrieval returns that item's synthetic code. |
| AT-03 | FEAT-04; SC-01, SC-04 | Ten available items, valid customer records, and replenishment paused for this test. | Submit twenty simultaneous assignment requests; inspect responses and stored records. | Exactly ten assignments succeed, no item is assigned twice, and excess requests follow the documented out-of-stock behavior. |
| AT-04 | FEAT-01, FEAT-05; SC-02 | Imported synthetic codes and an authorized retrieval path. | Inspect stored code values; retrieve a code through the authorized path; inspect collected logs. | Stored codes are encrypted, authorized retrieval is correct, and plaintext codes are absent from application logs. |
| AT-05 | FEAT-06; SC-02, SC-03 | Viewer, Operator, Administrator, and unauthenticated test callers; an agreed permission matrix. | Exercise protected read, write, code-retrieval, user-management, and configuration operations with each caller. | Every result matches the permission matrix; unauthorized access is denied by the API. |
| AT-06 | FEAT-08; SC-05 | A selected policy with explicit expected results and controlled stock/demand inputs. | Run low-demand, high-demand, and changing-demand scenarios; compare target stock and procurement decisions with expected values. | Decisions match the specified policy and stock limits; reducing targets does not discard existing items. |
| AT-07 | FEAT-08; SC-04, SC-05 | Two simulated suppliers with different interfaces and a known replenishment request. | Execute replenishment through each adapter and inspect imported items and stock counts. | Both adapters provide the expected item data through the common interface, and successful imports produce the expected stock changes. |
| AT-08 | FEAT-04, FEAT-05; SC-01, SC-04 | A controlled test environment with an available item. | Interrupt an assignment before the operation commits; inspect stock and assignment history. | The failed operation leaves no partial assignment or inconsistent item status. |
| AT-09 | FEAT-08; SC-04, SC-05 | A supplier simulator configured to fail and later recover; documented retry behavior. | Trigger replenishment during failure, restore the supplier, and exercise recovery. | Failure is visible, unsuccessful procurement adds no stock, and recovery produces the expected stock without duplicate item imports. |
| AT-10 | FEAT-02, FEAT-03, FEAT-04, FEAT-05, FEAT-06, FEAT-07; SC-03, SC-04 | Integrated dashboard/API and test users with the three roles. | Complete the operator import-to-assignment flow; inspect inventory and history as permitted; try a restricted action as Viewer. | Dashboard results agree with stored records, permitted actions work, and restricted actions are rejected by the backend. |

Before execution, finalize the permission matrix, replenishment rules, out-of-stock behavior, lifecycle rules, and recovery expectations in the Software Requirements Document. Define expected results independently of the implementation under test.

### 10.2 Acceptance Criteria

All five criteria must pass for internal completion. A failed criterion produces a tracked defect and a repeat of the affected tests after repair.

| Criterion ID | Acceptance criterion | Related tests | Required evidence |
| --- | --- | --- | --- |
| AC-01 | SC-01: No item is assigned more than once in the defined sequential, concurrent, and interrupted-operation scenarios. | AT-02, AT-03, AT-08 | Test results and assignment-record checks showing no duplicate or partial assignments. |
| AC-02 | SC-02: Stored codes are encrypted, and unauthorized code retrieval is denied. | AT-04, AT-05 | Sanitized storage inspection, retrieval checks, and access-test results. |
| AC-03 | SC-03: Viewer, Operator, and Administrator behavior matches the complete permission matrix. | AT-05, AT-10 | Completed permission matrix with API and dashboard test results. |
| AC-04 | SC-04: Available counts, item statuses, and assignment history remain consistent after successful, failed, and concurrent operations. | AT-01, AT-02, AT-03, AT-07, AT-08, AT-09, AT-10 | Before/after record checks and reproducible integration-test results. |
| AC-05 | SC-05: Demand and stock scenarios produce the target levels and procurement results required by the selected policy. | AT-06, AT-07, AT-09 | Scenario inputs, independently defined expected values, actual decisions, and supplier/stock outcomes. |

## 11. Document Task Matrix

These entries describe preparation of this document, not completion of the development work proposed above.

| Task | Responsible member | Document sections or files | Contribution evidence | Status |
| --- | --- | --- | --- | --- |
| Define scope, team organization, and management objectives | Ömer Kılınç | Sections 1-3 | Initial content in this document; Git commit pending. | Initial draft prepared |
| Prepare schedule, milestones, closure, and resource plan | Ömer Kılınç | Sections 4-5 | Initial content in this document; Git commit pending. | Initial draft prepared |
| Prepare risk, communication, and change-management plans | Ömer Kılınç | Sections 6-8 | Initial content in this document; Git commit pending. | Initial draft prepared |
| Estimate effort and additional resource costs | Ömer Kılınç | Section 9 | Initial content in this document; Git commit pending. | Initial draft prepared |
| Define acceptance tests and criteria | Ömer Kılınç | Section 10 | Initial content in this document; Git commit pending. | Initial draft prepared |
| Prepare document structure and contribution records | Ömer Kılınç | Front matter, table of contents, and Section 11 | Initial content in this document; Git commit pending. | Initial draft prepared |
