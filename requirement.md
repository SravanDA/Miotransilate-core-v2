# MioSalon — WhatsApp Two-Way Integration
## Business Requirement Document v3

---

## 1. Background & Current State

MioSalon is a Salon & Spa Management Software that offers Meta WhatsApp Business integration for salon/spa owners (referred to as "the salon" throughout this document). The salon links their WhatsApp phone number to their Meta Business Account, which is managed under MioSalon's master account.

### 1.1 What Is Already Working

**Outbound transactional messages** are sent automatically when specific events occur inside MioSalon. The supported notification types today are:

- Appointment confirmation (customer & staff)
- Appointment cancellation (customer, staff & manager)
- Appointment reschedule (customer & staff)
- Appointment reminder
- Appointment no-show
- Appointment pre-confirmation (manager & customer) — see Section 1.2 below
- Online booking notification (manager)
- Invoice
- Prepaid OTP
- Gift voucher
- Gift voucher reminder
- Discount coupon
- Service reminder
- Campaign / promotional messages (via the campaign module)
- Staff daily summary report

**Template management** is already integrated. Salon owners can create WhatsApp message templates inside MioSalon, submit them to Meta for approval, and use approved templates for the notification events above.

Templates today support: text body, media header (image or document), footer, and **button components** — including URL "Book Now" type buttons. The template builder already has this capability.

**Delivery receipts** (sent, delivered, read, failed) are received via Meta webhooks and stored internally. They are not yet surfaced to the salon in the UI.

**Daily conversation limit** per phone number is tracked and configurable inside MioSalon.

**Credit and plan management**: both credit-based and unlimited WhatsApp messaging plans are supported.

### 1.2 The Pre-Confirmation Flow — Clarification

The pre-confirmation feature (`enable_preconfirm`) is a **salon-side approval workflow**, not a customer confirmation step. It works as follows:

When a customer books an appointment (especially via online booking), some salons do not want to auto-confirm it immediately. Instead, the appointment is held in a pending state and a notification is sent to the **salon manager** to review and approve it. The reason varies by business strategy — some salons manage walk-in crowd vs appointment balance, some use double-booking to offset no-shows, and some simply want manual control. Once the manager approves, the appointment is confirmed and the customer is notified.

This is entirely the salon's internal decision — some salons auto-confirm all appointments, others manually pre-confirm. The setting is configurable per store.

### 1.3 What Is Missing

The integration is currently **one-way**: messages flow from MioSalon to the customer, but customer replies are not received, processed, or shown anywhere in MioSalon. This is the core gap this document addresses.

---

## 2. Vision

Transform MioSalon's WhatsApp integration into a **full two-way conversational platform** where salon staff can read customer replies, respond to them, and manage conversations — all within MioSalon. Two-way integration will become the basic integration provided by default to all accounts (replacing the previous one-way system). The same inbox must be designed from the start to support other messaging channels (Line, SMS) under a unified interface, so the salon manages all customer communication in one place.

---

## 3. Inbound Message Handling

### 3.1 Types of Customer Messages to Support

- Text replies — plain text response from the customer
- Button-tap responses — when the customer taps a quick-reply button on a template message (see Section 6)
- List selection responses (Interactive templates) — when the customer selects an option from a list message
- Media messages — images, documents, audio, video sent by the customer (see Section 12)

Location sharing and contact card sharing are out of scope.

### 3.2 Routing Inbound Messages and Phone Number Topology

MioSalon is a multi-tenant, multi-location platform supporting both single-location salon accounts and multi-location brand hierarchies. When a customer message arrives, the system routes it to the correct salon, brand level, franchise cluster, or specific outlet based on the configured number topology:

**1. Single-Location Accounts**
- **Single Number (Shared)**: A single WhatsApp number handles both transactional notifications and promotional campaigns for the salon.
- **Dual Numbers**: Two separate numbers are configured (one dedicated to Transactional notifications, one dedicated to Promotional campaigns) to protect the core appointment reminder rating.

**2. Multi-Location Accounts (3-Tier Hierarchy)**
- **Central Level (Brand / Corporate Network)**:
  - **Central Single Number**: A single WhatsApp number shared across all outlets for both Transactional & Promotional messages, managed centrally by corporate/CRM teams.
  - **Central Dual Numbers**: Two central numbers (1 dedicated to Transactional alerts across all locations, 1 dedicated to Promotional marketing blasts across all locations).
- **Franchise Level (Regional / Cluster Group)**:
  - **Franchise Single Number**: A single WhatsApp number shared across a specific cluster of franchise locations for both Transactional & Promotional messages.
  - **Franchise Dual Numbers**: Two numbers assigned to a franchise cluster (1 for Transactional, 1 for Promotional) serving all outlets within that regional group.
- **Location Level (Individual Branch / Outlet)**:
  - **Location Single Number**: A dedicated WhatsApp number assigned to a specific branch, handling both Transactional & Promotional messages for that location.
  - **Location Dual Numbers**: Two dedicated numbers assigned to a specific branch (1 for Transactional, 1 for Promotional) serving only that store.

The system recognises whether a WhatsApp phone number is registered at the Single-Location, Central Brand, Franchise Cluster, or Individual Branch level, and routes inbound messages and inbox views accordingly. Outlets operating under central or franchise numbers can have conversation access scoped via roles & permissions.

### 3.3 Linking Inbound Messages to Customer Records

When a message arrives from a customer's phone number, the system must attempt to find a matching customer record using the existing customer search capability, searching first by the store/outlet and then at the network level as appropriate for the phone number configuration (Case 1 or Case 2 above).

**If a customer record is found:** The conversation is linked to that customer. Staff can navigate from the conversation to the customer's full profile.

**If no customer record is found:** The message is still shown in the inbox. The sender is flagged as a "New Contact." The salon must have a configurable setting to decide what happens with unrecognised senders:

- **Option A — Create Customer**: Automatically or manually create a standard customer record from the conversation view.
- **Option B — Create Lead**: Create a lead record (for salons that operate a CRM pipeline) and trigger any lead-management actions accordingly.

This setting is configured per salon account.

---

## 4. WhatsApp Inbox

### 4.1 Inbox Overview

MioSalon must provide a dedicated **Messaging Inbox** screen accessible to authorised salon staff. This is the single place to view and respond to all incoming and outgoing conversations.

The inbox shows a list of conversations, sorted by most recent activity. Each conversation entry displays:
- Customer name (if matched) or phone number with "New Contact" badge (if unmatched)
- Preview of the last message
- Time of the last message
- Unread message count
- Session status indicator: whether the 24-hour reply window is currently open or expired
- Conversation status: Active / Resolved

### 4.2 Filtering & Search

Staff must be able to filter and search the inbox by:

- **Status**: All, Active Responses (customers who have replied and are awaiting a salon reply), Resolved
- **Notification type**: Filter by the type of outbound message that started the conversation — e.g., show all conversations where the initial message was an Appointment Reminder, Invoice, OTP, Service Reminder, Birthday Wish, Campaign, etc.
- **Customer search**: Search by customer name or phone number to quickly find or start a conversation
- **Location filter**: For staff with access to multiple branches, a toggle to view conversations for "This Location" or "All Locations" they have access to

### 4.3 Conversation Thread View

Selecting a conversation opens the full message thread — all messages exchanged between the salon and the customer in chronological order, in a chat-style layout.

Each message in the thread shows:
- Direction: inbound (from customer) or outbound (from salon/system)
- Message content
- Timestamp
- For outbound messages: delivery status (Sent / Delivered / Read / Failed) and the sender — either the name of the staff member who replied, or "System" if the message was sent automatically by a transactional event
- For OTP messages: the message thread must show that an OTP was sent (e.g., "OTP message sent"), but the OTP value itself must be **masked**. Salon staff must never see the actual OTP code.

### 4.4 Replying to Customers

From the conversation thread, authorised staff can reply to a customer. The reply experience depends on the 24-hour session window (see Section 5):

- **Session active**: The text input is open. The staff member types a free-form message and sends it. The reply is logged against their name.
- **Session expired**: The text input is locked. The system shows a message explaining that the session has expired. The staff must select an approved template to re-engage the customer. Once the customer responds, the session reopens.

### 4.5 Initiating a New Conversation

A staff member can search for a customer by name or phone number and start a new WhatsApp conversation. Since the 24-hour session has not been opened by the customer, the staff must choose an approved template message to initiate the conversation. Free-form messaging is not available until the customer replies and opens the session.

### 4.6 Marking Conversations as Resolved

Once a conversation is handled, staff can mark it as Resolved. The system records who resolved it and when. Resolved conversations move out of the active view but remain searchable in history.

> Flag conversation and internal notes are deferred and excluded from current scope.

### 4.7 Role-Based Access

Access to the Messaging Inbox is controlled by MioSalon's existing roles and permissions system. Only staff members with the inbox permission can view and respond to conversations. This is configurable per role.

### 4.8 Real-Time Updates

When a new customer message arrives, the inbox must update in real time without requiring a manual refresh. An audio or visual notification must alert staff to the new message so they are aware even when not actively looking at the inbox screen.

### 4.9 The 24-Hour Conversation Session

WhatsApp Business rules define a **24-hour service window**: a business may send a free-form message to a customer only within 24 hours of the customer's last inbound message. After that window closes, only pre-approved template messages may be sent.

#### 4.9.1 How the Session Works

The session starts the moment a customer sends a message. The 24-hour window starts from this first reply and **does not reset** as the customer continues to reply. The session expires exactly 24 hours after the customer's initial inbound message. Automated replies triggered by button taps (Camunda workflows) do not initiate or reset the session window; only direct customer replies do.

The system determines the session state at any point in time by comparing the current timestamp against the timestamp of the customer's last inbound message. No background scheduled processing is required — it is a real-time check performed when staff attempt to reply.

#### 4.9.2 Session Experience for Staff

The conversation thread must clearly show whether the session is currently active or expired.

When active, an indicator shows the staff that they can send a free-form message.

When expired, the reply box is locked, the session-expired state is shown, and the staff is guided to pick an approved template to re-engage the customer.

---

## 5. Interactive Templates & Button-Driven Actions

### 5.1 Current Template Button Capability

The existing template management already supports adding buttons to templates — for example, a URL button such as "Book Now." This capability is in place and the template builder supports it.

### 5.2 Action-Driven Quick-Reply Buttons (New Requirement)

In addition to URL buttons, templates must support **quick-reply buttons that trigger a specific MioSalon business action** when the customer taps them. This is fundamentally different from a URL button — it is a two-way event: the customer taps, and MioSalon responds automatically.

**How it works:**
1. The salon configures a template with a quick-reply button and associates that button with a specific MioSalon action (e.g., "Confirm Appointment", "Cancel Appointment", "Reschedule").
2. The template is sent to the customer (e.g., as an appointment reminder).
3. The customer taps the button.
4. MioSalon receives the button-tap response via webhook.
5. MioSalon automatically executes the associated action internally (e.g., marks the appointment as confirmed, or triggers the cancellation flow).
6. MioSalon automatically sends a follow-up message to the customer confirming what happened (e.g., "Your appointment on [date] is now confirmed. See you soon!").

The salon staff do not need to manually intervene when a customer taps an action button — the entire flow is automated.

### 5.3 Template Complexity Choice per Salon

For every notification event, the salon owner decides whether to use a simple or interactive template:

- **Simple template**: Plain text or text with media. No customer interaction is required or expected. The salon treats it as a one-way notification.
- **Interactive template**: Includes quick-reply or URL buttons. The customer can take action directly from the message.

This is a per-store configuration choice made at the notification settings level. Neither option is forced on the salon.

### 5.4 The Pre-Confirmation Flow and Buttons

The pre-confirmation flow (salon manager approves customer appointments) is currently separate from the customer-facing button experience.

For the **customer-facing appointment confirmation message** (sent after the manager approves), a quick-reply button can optionally be added — for example, "Confirm" or "I Need to Reschedule" — allowing the customer to acknowledge or request a change. Whether this is used is the salon's choice.

The pre-confirmation flow itself (manager approval side) remains as-is and is not part of the initial WhatsApp two-way scope.

### 5.5 Notification Templates to Enhance with Button Support

The following enhancements are proposed. All are optional per salon configuration:

| Notification | Current | Proposed Enhancement |
|---|---|---|
| **Appointment Reminder** | Text only | Add "Confirm" / "Cancel" / "Reschedule" quick-reply buttons |
| **Appointment Confirmation** | Text only | Optionally add "Add to Calendar" URL button |
| **Invoice** | Text only | Add invoice as document. If unpaid: add "Pay Now" URL button. If paid: document only, no payment button |
| **Service Reminder** | Text only | Add "Book Now" URL button |
| **Membership / Prepaid Expiry** | Text only | Add "Renew Now" URL button — only if the renewal program is active for that salon |
| **No-Show Follow-Up** | Not present (new) | New: send follow-up after a no-show with "Rebook" URL button |
| **Waitlist Notification** | Not present (new) | New: when a slot opens, notify the waitlisted customer with "Accept Slot" and "Decline" buttons |
| **Post-Visit Tips** | Not present (new) | New: send after-care tips with optional rich media (image or short video) |
| **Birthday / Anniversary** | Text only | Remains text only (no personalised offer button — offer management not yet in scope) |

### 5.6 Carousel Messages (Transactional)

Carousel support should be evaluated for applicable transactional templates where multiple items are relevant (e.g., showing multiple services booked in one appointment).

Carousel message support for campaigns is explicitly excluded.

### 5.7 Template Management Experience (Redesign)

The legacy template management module will be completely rebuilt to provide a seamless, end-to-end user experience for creating, approving, and deploying WhatsApp templates.

The new template management lifecycle must include:

1. **Context-Aware Variables**: When a user creates a new template for a specific notification type (e.g., Appointment Reminder, Invoice), the system dynamically presents only the variables (e.g., `{{customer_name}}`, `{{appointment_time}}`) supported for that exact context. The user can easily insert these variables into the template body or buttons.
2. **Rich Template Builder**: The user constructs the template (adding text, media headers, footers, and interactive quick-reply/URL buttons) alongside a real-time WhatsApp chat preview.
3. **Submission for Approval**: The user submits the completed template directly to Meta for review from within the MioSalon UI. The template enters a "Pending" state.
4. **Approval Notification**: Once Meta approves (or rejects) the template, the user is proactively notified (via an in-app notification or alert) so they know the outcome immediately without needing to manually check the status.
5. **Activation & Usage**: Upon approval, the template's status updates to "Approved" and it instantly becomes available for selection in the corresponding notification settings or for manual use in the messaging inbox.
6. **Template Mapping Limitation**: Templates can only be mapped to notification events after they have been approved by Meta. Users must wait until approval is granted before mapping.

---

## 6. Delivery Analytics & Insights

### 6.1 Per-Message Status in Thread View

The delivery status of every outgoing WhatsApp message is already received via webhooks. This status must be surfaced to the salon in the conversation thread:

- Each outbound message shows its current status: Sent, Delivered, Read, or Failed.
- For failed messages, the reason for failure must be shown (e.g., number not on WhatsApp, daily limit reached, blocked by the customer).

### 6.2 Insights Dashboard

A dedicated insights screen must show aggregated delivery metrics for a selected date range:

- Total messages sent, delivered, read, and failed
- Delivery rate and read rate as percentages
- URL button click-through metrics (tracked via MioSalon redirect links)
- Breakdown by message type (transactional vs promotional)
- Breakdown by template name
- Conversation metrics: total conversations initiated, average staff response time, number of conversations resolved

---

## 7. Account Health & Monitoring

### 7.1 Account Status Dashboard

The WhatsApp settings screen must show the real-time health of the salon's Meta WhatsApp Business Account:

- **Payment status**: Whether the account is active or disabled due to a payment failure on their Meta account
- **Account quality rating**: The quality tier assigned by Meta (Green / Yellow / Red)
- **Phone number quality**: Quality score specific to each registered phone number
- **Messaging tier**: The number of unique customers the salon can message per 24-hour period (e.g., 1,000 / 10,000 / 100,000 / Unlimited)
- **Daily usage vs limit**: A progress indicator showing messages sent today vs the allowed limit. A warning must appear when 90% of the daily limit is reached — visible in the main navigation or dashboard header, not only on the settings page.
- **Quota Allocation & Number Topology Management**: The system supports both single-location accounts and multi-location brand hierarchies, offering single-number or dual-number configurations across all tiers:
  - **Single-Location Accounts**: Supports Single Number (shared quota between Transactional & Promotional) OR Dual Numbers (dedicated Transactional number + dedicated Promotional number).
  - **Multi-Location Accounts (3-Tier Hierarchy)**:
    - **Central Tier**: Central Single Number (shared across all locations) OR Central Dual Numbers (dedicated Central Transactional + Central Promotional numbers).
    - **Franchise Tier**: Franchise Single Number (shared across cluster) OR Franchise Dual Numbers (dedicated Franchise Transactional + Franchise Promotional numbers).
    - **Location Tier**: Location Single Number (shared for branch) OR Location Dual Numbers (dedicated Location Transactional + Location Promotional numbers).
  - **Single-Number Quota Partitioning**: For setups using a single WhatsApp number (whether single-location, central, franchise, or location-specific), the total Meta daily quota is partitioned between **Transactional** and **Promotional** categories.
  - **Allocation Controls**: Quota partitioning can be configured either by a **Fixed Number** (e.g., 700 transactional / 300 promotional) or by **Percentage** (e.g., 70% transactional / 30% promotional).
  - **Buffer Slippage / Overflow Zone**: A configurable buffer limit (by value or percentage, e.g., 10% or 100 messages) allows one message category (e.g., promotional campaigns) to temporarily consume unconsumed quota from the opposite category's budget once its base allocation is depleted.
  - **Strict Allocation Mode**: The buffer zone can be set to zero (`0`), enforcing a strict allocation policy where overages in a category are immediately blocked upon reaching its limit without borrowing.

### 7.2 Account Block / Restriction Alerts

If the salon's WhatsApp account becomes blocked, restricted, or disabled by Meta, a prominent warning banner must appear in the MioSalon application — visible from the main dashboard — so that the salon is immediately aware that their messages are not being delivered.

### 7.3 Blocked Users

The system must track customers who have blocked the salon's WhatsApp number. This is detectable from message failure events. The total count of blocked customers must be shown in the account health dashboard. Staff must be able to view the list of these customers so they can be excluded from future campaigns.

---

## 8. New Contact Management from Inbox

When a conversation comes from an unrecognised phone number (no matching customer record), the inbox shows it flagged as "New Contact."

The salon must have a configurable setting to decide how to handle new contacts:

**Convert to Customer**: The staff member can create a standard customer record from within the inbox view. The system pre-fills the phone number. The staff completes the customer's details and saves. The conversation is then linked to the new customer record.

**Convert to Lead**: For salons that manage a sales pipeline, the new contact is created as a lead record and any lead-tracking workflows are triggered.

The default behaviour (customer vs lead) is configured once per salon account.

---

## 9. WhatsApp Flows (In-Chat Interactive Forms)

WhatsApp Flows is a Meta capability that allows a business to present structured, form-based interactive experiences entirely within WhatsApp — without the customer needing to open a browser or a separate app.

This is a significant differentiator, as no major salon software competitor currently offers this.

**Proposed use cases:**

- **Self-service appointment booking**: The customer selects a service, chooses a date, picks a time slot, and confirms — all within the WhatsApp conversation.
- **Pre-appointment intake / consultation form**: The customer fills in a consultation questionnaire before a specialist service.
- **Post-visit feedback**: A structured feedback form (service and experience rating, comments) sent after the visit, completed in-chat.
- **New customer registration**: A new customer can share their name, preferences, and contact details through a WhatsApp flow.

---

## 10. Payment via WhatsApp

MioSalon already integrates with multiple payment gateways across different regions. This integration is extended to support collecting payment from customers via WhatsApp.

### 10.1 Use Cases

- **Unpaid invoice**: After a service, if payment was not collected at the salon, the staff can send the invoice via WhatsApp with a "Pay Now" button. The button opens a payment link generated by the salon's configured payment gateway.
- **Advance / deposit**: For bookings that require a deposit, the salon sends a payment request via WhatsApp before the appointment.
- **Membership or prepaid renewal**: When a package or membership expires and the renewal program is active, a renewal payment link can be sent.

### 10.2 Payment Flow Overview

The salon (or the system automatically) sends a WhatsApp message with a "Pay Now" button. The button opens a dynamically generated, transaction-specific payment link. The customer completes payment in their browser. The payment gateway triggers a webhook to MioSalon. MioSalon processes the webhook, reconciles the payment against the correct bill or appointment, updates the record, and automatically sends a payment confirmation message to the customer via WhatsApp.

The payment link must be generated based on the salon's configured gateway (region-specific). Each link is unique to the transaction. Link expiry handling, manual resend, and the exact webhook reconciliation flow — including how the payment maps back to customer bills and appointments — must be detailed separately before implementation begins.

---

## 11. Customer Media Asset Management

When customers send media (images, documents, audio, video) in a conversation, these files must be downloaded from Meta (Meta stores them only temporarily), stored securely in MioSalon's cloud storage (S3), and made viewable by authorised salon staff in the conversation thread.

MioSalon is a multi-tenant application. Storage must strictly isolate data between salon accounts — no salon must be able to access another salon's customer media.

Over time, media shared by or received from a customer should be accessible as **customer-level assets** on their profile — for example, a photo of a hairstyle a customer shared as a reference for the stylist.

---

## 12. Customer Consent Management (Opt-In / Opt-Out)

WhatsApp Business rules and data protection regulations require that salons only message customers who have explicitly consented to receive WhatsApp communications.

### 12.1 Opt-In

MioSalon must provide a way to capture and record each customer's consent to receive WhatsApp messages. Consent must be:

- **Explicit**: The customer takes an affirmative action — not a pre-ticked checkbox.
- **Channel-specific**: WhatsApp consent is recorded separately from SMS or email consent.
- **Type-specific**: Separate consent for transactional messages (appointment reminders, invoices — often covered by "performance of contract") and marketing messages (campaigns, promotions — requiring explicit opt-in).
- **Auditable**: The date, time, and channel through which consent was given must be recorded per customer.

Proposed opt-in collection points:
- Online booking form (checkbox at time of booking)
- Point of sale — when creating or updating a customer profile
- Via WhatsApp itself — a one-time opt-in template message with a "Yes, opt me in" button

### 12.2 Opt-Out

Customers must be able to withdraw consent at any time. The system must:

- Automatically detect opt-out keywords in customer replies (e.g., "STOP", "UNSUBSCRIBE") and immediately flag the customer as opted out.
- Optionally include a "Stop Messages" quick-reply button in promotional templates.
- Ensure that once a customer opts out of marketing, no further promotional messages are sent. Transactional messages may still be sent depending on the legal basis configured for the salon's region.

### 12.3 Consent Status on Customer Profile

Each customer's WhatsApp consent status (Opted In / Opted Out / Not Set) must be visible on their profile in MioSalon. Staff must be able to update it manually when a customer communicates their preference in person or via another channel.

---

## 13. Multi-Channel Unified Inbox

The Messaging Inbox described in this document must be designed as a **channel-agnostic unified inbox** from the outset. The same interface must support other messaging channels in the future without rebuilding the experience:

- **Line** — popular in Southeast Asian markets
- **SMS / text messages**
- Potentially other platforms

A salon staff member sees all customer conversations across all channels in one inbox. Each conversation is tagged with its channel (WhatsApp, Line, SMS). The staff member replies via the same channel the customer used. Channel-specific rules — such as the 24-hour session for WhatsApp, or different template requirements for Line — are handled by the system behind the scenes, transparently to the staff member.

---

## 14. Message Retention Policy

WhatsApp does not store messages on its servers after delivery. MioSalon is responsible for retaining the conversation history.

**Current policy**: All conversation messages and history will be **retained indefinitely**. No automatic purging will be applied in the initial implementation.

A configurable retention policy (allowing salons to define a data retention window to manage storage) will be introduced in a future phase when storage cost management becomes a priority. This will be scoped and planned at that time.

---

## 15. Implementation Scope

- Receiving and processing inbound text messages and button-tap responses
- Routing conversations by phone number type (per-location vs centralised)
- Linking inbound messages to customer records; new contact detection and handling (create customer or lead)
- Messaging Inbox: conversation list, filters, real-time updates, thread view, reply (free-form and template), initiate conversation, mark as resolved
- 24-hour session management — real-time check, locked reply when expired
- Role-based access control for the inbox
- Multi-location inbox filter (This Location / All Locations)
- Delivery status per message in thread view (Sent / Delivered / Read / Failed with reason)
- OTP message content masking in thread view
- Account health & monitoring dashboard (payment status, quality rating, messaging tier, daily usage, block alerts)
- Blocked users count and list
- Full delivery analytics and insights dashboard
- Conversation metrics (response time, resolution rate)
- Action-driven quick-reply button support in template management
- Template enhancements: Appointment Reminder (confirm/cancel/reschedule buttons), Invoice (document + conditional Pay Now), Service Reminder (Book Now), Membership/Prepaid Expiry (conditional Renew Now), No-Show Follow-Up (new), Waitlist Notification (new), Post-Visit Tips (new)
- Pre-confirmation customer-facing message optional button support
- Manager pre-confirmation approval via WhatsApp button (manager taps Approve/Reject directly from WhatsApp)
- Build the entire template management inside this module (replacing the legacy template management for improved UX)
- AI auto-reply rules (business hours response, keyword-based)
- WhatsApp Flows (self-service booking, intake forms, post-visit feedback, new customer registration)
- Payment collection via WhatsApp (external payment link sent via WhatsApp; payment gateway and link expiry managed by the salon's configured gateway externally; MioSalon handles the webhook reconciliation back to the customer's bill/appointment record)
- Inbound media handling (image, document, audio, video)
- Customer media asset management (S3 storage, customer profile gallery, multi-tenant isolation)
- Customer consent management — separate opt-in/opt-out for transactional messages and promotional messages; audit trail; consent status on customer profile
- Line messaging channel integrated into the unified inbox
- SMS channel integrated into the unified inbox

---

## 16. Resolved Decisions

The following questions have been answered and incorporated into the requirement:

1. **Button follow-up message customisation** — Every automated follow-up message sent by the system after a button-tap action is fully customisable by the salon user, following the same model as all other notification templates in MioSalon. Each button action is mapped to a use-case (e.g., "Appointment confirmed by customer"), and the corresponding message template is created and managed through the existing Notification Template Management UI. No fixed system messages — everything is configurable per salon.

2. **Unrecognised sender default behaviour** — In the WhatsApp Settings page, the salon user defines their default behaviour for new inbound contacts: either "Create as Customer" or "Create as Lead." When a message arrives from an unrecognised number, the system automatically creates the appropriate record type based on this setting. In the inbox, the staff member sees an "Update Customer" or "Update Lead" button (matching the salon's configured default) which opens a form to capture additional details — name, email, etc. — to complete the record.

3. **Opt-out scope** — Separate opt-out controls for transactional messages and promotional/campaign messages. Customers can opt out of promotions while still receiving transactional messages (e.g., appointment reminders, OTP), or opt out of all WhatsApp messages entirely. The opt-out preference per category is stored against the customer's record.

4. **Payment link expiry** — MioSalon sends an external payment link (generated by the salon's configured payment gateway) via WhatsApp as a URL button. The payment link expiry is configured and managed within the payment gateway itself, outside MioSalon's control. MioSalon's responsibility is limited to: generating the correct gateway link, sending it via WhatsApp, and processing the payment completion webhook to reconcile the payment against the customer's bill or appointment record.

5. **Pre-confirmation manager approval via WhatsApp** — Confirmed as a planned enhancement. When a pre-confirmation notification is sent to the salon manager via WhatsApp, it will include "Approve" and "Reject" quick-reply buttons. Tapping "Approve" automatically confirms the appointment and triggers the customer confirmation flow. Tapping "Reject" triggers the cancellation or hold flow.
