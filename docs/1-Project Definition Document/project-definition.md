# Project Definition Document

**Document version:** 0.1 (Initial draft)

**Date:** 11 October 2026

## Document Contributors

| Full name | Student number | Contribution to this document |
| --- | --- | --- |
| Ömer Kılınç | 261111011 | Project definition, objectives, scope, target audience, features, deliverables, and success criteria. |

## Table of Contents

1. [Project Name](#1-project-name)
2. [Project Summary](#2-project-summary)
3. [Objectives](#3-objectives)
4. [Scope](#4-scope)
5. [Target Audience](#5-target-audience)
6. [Key Features](#6-key-features)
7. [Deliverables](#7-deliverables)
8. [Project Success Criteria](#8-project-success-criteria)
9. [Document Task Matrix](#9-document-task-matrix)

## 1. Project Name

**Talebe Uyarlanabilir Envanter ve Anlık Sipariş Karşılama Sistemi**

**English name:** Demand-Adaptive Inventory and Instant Order Fulfillment System

## 2. Project Summary

The project is a digital inventory and fulfillment system for a single organization. It securely stores unique digital items, such as license keys, prepaid vouchers, and activation codes, so staff can fulfill customer requests from available stock. Authorized staff use an API and dashboard to manage a shared inventory and assign items to minimal customer records. Each item can be assigned only once, and its assignment history remains available.

The system monitors inventory and replenishes stock in the background according to demand frequency, demand quantity, and stock limits. Strategy defines replenishment policies, Adapter supports supplier integrations, and State controls item lifecycle behavior. The project aims to reduce manual inventory management while maintaining secure storage and reliable assignments.

## 3. Objectives

| Objective ID | Objective |
| --- | --- |
| OBJ-01 | Securely store unique digital codes and restrict their retrieval to authorized staff. |
| OBJ-02 | Assign available items to customers without duplicate assignments, including during simultaneous requests. |
| OBJ-03 | Provide a shared view of available stock, item statuses, and assignment history. |
| OBJ-04 | Enforce Viewer, Operator, and Administrator permissions through the API and dashboard. |
| OBJ-05 | Adapt background replenishment to changes in demand frequency, demand quantity, and stock levels. |

## 4. Scope

### 4.1 Included in Scope

- One organization with one shared inventory accessible to assigned staff according to their roles.
- Management of product types and individual digital items, including item imports and lifecycle tracking.
- Encrypted storage of digital codes and controlled retrieval of assigned codes.
- Minimal customer records containing an ID, creation and update timestamps, and an optional email address.
- Assignment of an available item to a customer, with each item assignable only once.
- Permanent item records and separate assignment records identifying the customer, responsible staff member, and assignment time. Assigned items are excluded from available stock and retained in assignment history.
- Staff authentication and authorization using Viewer, Operator, and Administrator roles.
- An API and dashboard for authorized staff operations.
- Background inventory monitoring and replenishment through supplier interfaces.
- Use of Strategy, Adapter, and State to support replenishment policies, supplier integrations, and item lifecycle behavior respectively.

For the initial scope, fulfillment is complete when an item is assigned and its code is available to authorized staff. Supplier implementations, the technology stack, the authentication mechanism, out-of-stock behavior, detailed lifecycle states, and the exact replenishment algorithm remain design decisions. Doubling or halving target stock levels is a candidate replenishment approach; reducing a target affects future procurement and does not discard existing items.

### 4.2 Excluded from Scope

- Payment processing.
- Customer accounts, customer authentication, and direct customer access to the API or dashboard.
- Support for multiple organizations or separate user inventories.
- Inventory cloning or splitting.
- Automatic email delivery in the initial version.

## 5. Target Audience

The system is intended for staff of an organization that distributes unique digital products. Customers are recorded recipients and do not operate the system.

| Audience | Needs | Expected use of the system |
| --- | --- | --- |
| Viewers | Visibility into stock without permission to modify inventory or retrieve digital codes. | Inspect product information, available quantities, and item statuses. |
| Operators | Tools for daily inventory and customer assignment work. | Import and manage items, maintain customer records, create assignments, and retrieve assigned codes. |
| Administrators | Control over staff access and system configuration. | Perform operator tasks, manage staff accounts and roles, and configure replenishment settings. |

## 6. Key Features

| Feature ID | Feature | Description |
| --- | --- | --- |
| FEAT-01 | Secure item storage | Store unique digital codes encrypted and associate each item with a product type. |
| FEAT-02 | Inventory monitoring | Display available quantities and item statuses for the shared inventory. |
| FEAT-03 | Customer records | Maintain customer IDs, creation and update timestamps, and optional email addresses. |
| FEAT-04 | Item assignment | Assign an available item to one customer, preventing duplicate assignment even during simultaneous requests. |
| FEAT-05 | Assignment history | Preserve the item, recipient, responsible staff member, and assignment time, with controlled retrieval of assigned codes. |
| FEAT-06 | Staff access control | Authenticate staff and enforce Viewer, Operator, and Administrator permissions. |
| FEAT-07 | API and dashboard | Provide interfaces for authorized staff to inspect inventory and perform permitted operations. |
| FEAT-08 | Adaptive replenishment | Adjust procurement according to demand and stock levels through configurable policies and supplier interfaces. |

## 7. Deliverables

The three documents below form the PA-1 planning and design package. The application, repository setup, and test evidence describe the intended deliverables of the completed project.

| Deliverable | Description | Completion condition |
| --- | --- | --- |
| Working application | API, dashboard, database, and background replenishment process supporting the defined scope. | The application supports the agreed core use cases and meets the project success criteria. |
| Source code and setup instructions | Application source, database setup, configuration guidance, and execution instructions in the GitHub repository. | A team member can configure and run the application using the documented steps. |
| Test evidence | Test cases and recorded results for assignments, storage protection, permissions, inventory consistency, and replenishment behavior. | Results demonstrate whether each success criterion is met and identify any unresolved failures. |
| Project Definition Document | Project purpose, objectives, scope, audience, features, deliverables, and success criteria. | Required sections, contributor information, and the document task matrix are complete and reviewed. |
| Project Plan Document | Development organization, timeline, resources, risks, communication, change management, effort allocation, and acceptance planning. | Required planning sections, contributor information, and the document task matrix are complete and reviewed. |
| Software Requirements Document | Functional and non-functional requirements, four core use cases, interfaces, a UML use case diagram, an architecture overview, and justified pattern mappings. | The four use cases are documented, supported by the architecture, and each mapped to at least one relevant design pattern; contributor information and the task matrix are complete. |

## 8. Project Success Criteria

These are targets for the completed application. They do not represent tests already performed.

| Criterion ID | Success criterion | Target | Measurement method |
| --- | --- | --- | --- |
| SC-01 | No duplicate item assignments | Zero items assigned more than once across the assignment test scenarios, including concurrent requests. | Run sequential and concurrent assignment tests and inspect assignment records for duplicate item references. |
| SC-02 | Protected digital codes | All stored item codes are encrypted, and all unauthorized code retrieval attempts in the defined tests are denied. | Inspect stored item records and execute code retrieval tests for authenticated and unauthenticated callers with the relevant roles. |
| SC-03 | Correct role enforcement | All checks in the defined Viewer, Operator, and Administrator permission matrix pass. | Exercise protected API operations with each role and compare allowed and denied results with the permission matrix. |
| SC-04 | Consistent inventory | Available stock, item statuses, and assignment history agree after every tested import and assignment scenario. | Compare displayed stock quantities and stored records before and after successful, failed, and concurrent operations. |
| SC-05 | Demand-responsive replenishment | All predefined demand scenarios produce the target stock levels and procurement quantities specified by the selected policy. | Run controlled demand and stock scenarios and compare replenishment decisions and resulting stock changes with expected results. |

## 9. Document Task Matrix

| Task | Responsible member | Document sections or files | Contribution evidence | Status |
| --- | --- | --- | --- | --- |
| Define the project name, summary, and objectives | Ömer Kılınç | Sections 1-3 | Initial content in this document; Git commit pending. | Initial draft prepared |
| Define scope, target audience, and key features | Ömer Kılınç | Sections 4-6 | Initial content in this document; Git commit pending. | Initial draft prepared |
| Define deliverables and measurable success criteria | Ömer Kılınç | Sections 7-8 | Initial content in this document; Git commit pending. | Initial draft prepared |
| Prepare document structure and contribution records | Ömer Kılınç | Front matter, table of contents, and Section 9 | Initial content in this document; Git commit pending. | Initial draft prepared |
