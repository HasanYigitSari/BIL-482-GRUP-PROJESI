# Project Summary

**Project name:** Talebe Uyarlanabilir Envanter ve Anlık Sipariş Karşılama Sistemi  
**English name:** Demand-Adaptive Inventory and Instant Order Fulfillment System

## Overview

The project is a digital inventory and fulfillment system for a single organization. It stores unique digital items, such as license keys, prepaid vouchers, and activation codes, in advance so that customer requests can be fulfilled immediately when stock is available. Each item belongs to a product type and contains a unique code that is stored encrypted in the database.

Staff use an API and a dashboard to work with one shared inventory. The main business operation is assigning an available item to a customer. There is no payment processing. Customers are minimal records containing an ID, creation and update timestamps, and an optional email address; they do not have accounts or access to the system.

## Inventory and Assignments

The basic flow is: **insert an item → make it available → receive a customer request → assign the item → remove it from available stock**.

Each item remains in a permanent items table throughout its lifecycle. An assignment record links it to a customer and records when the assignment occurred and which staff member performed it. Assignment creation and the item status change happen together, ensuring that each item can be assigned only once, including during simultaneous requests.

Assigned items are excluded from available inventory but remain accessible through assignment history. Viewing stock does not automatically reveal stored codes. For the initial scope, fulfillment is complete when an item is assigned and its code is available to authorized staff.

## Demand-Based Replenishment

The system monitors stock changes and replenishes inventory in the background. Demand frequency and quantity guide the desired stock level for each product type. A strategy inspired by geometric resizing, such as doubling or halving target stock levels, is a candidate approach. The exact algorithm, thresholds, and limits will be developed later. Reducing a target affects future procurement and does not discard existing items.

## Staff Roles

- **Viewer:** inspects inventory information, quantities, and statuses.
- **Operator:** imports and manages items, maintains customer records, creates assignments, and retrieves assigned codes.
- **Administrator:** has operator capabilities and also manages staff accounts, roles, and replenishment settings.

All staff share the same inventory, with permissions enforced by the API. Customers never authenticate.

## Design Patterns

- **Strategy:** defines interchangeable replenishment policies based on demand and stock limits.
- **Adapter:** provides a common interface for different suppliers.
- **State:** governs item lifecycle behavior and permitted transitions.

## Scope and Open Decisions

The initial scope covers one organization and one shared inventory. Separate user inventories, inventory cloning or splitting, customer accounts, and payment processing are excluded. Email delivery may be considered later.

The technology stack, authentication mechanism, supplier implementations, out-of-stock behavior, detailed lifecycle states, and replenishment algorithm remain open design decisions.
