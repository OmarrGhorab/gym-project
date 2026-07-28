# Admin dashboard QA flows

Last checked: 2026-07-28 (local development environment, signed in as `admin@gym.test`).

This is a controlled QA record. Read-only routes are inspected against the shared local data; write flows use clearly named `QA Browser Rotation 20260728` records only, unless noted otherwise.

## Verified flows

| Area | Safe flow checked | Expected outcome |
| --- | --- | --- |
| Authentication | Sign in with the seeded admin account | Redirects to Dashboard and shows the admin navigation. |
| Members | Open a member search URL (`?q=Jana%20Ragab`) | The table narrows to matching members and the toolbar reports the matching total. |
| Members | Open and close **Add Member** | Shows the complete member form; closing does not create a member. |
| Users | Open and close **Create account** | Shows name, email, password confirmation, roles, and optional unlinked-staff selector. |
| Roles | Load the role table and role-creation panel | System roles, permission toggles, and custom-role form render. Do not submit role/permission writes during QA. |
| Reports → Employees | Change to the employee report with a date range | Shows sales activity, POS sales, and earned/reversed/net commission separately. |
| Reports → Employee details | Open and close an employee’s **Details** dialog | Shows a commission ledger with member, source, rule, amount, refund reversal, and status. |
| POS | Open **Checkout** and the `?action=checkout` shortcut | Opens **Create POS sale** with product, quantity, discount, payment, optional member, and notes fields. Closing removes the query parameter. |
| Calendar | Open and close the `?action=new-event` shortcut | Opens the complete gym-operations event form and returns to the calendar without creating an event. |
| Finance | Open and close the `?action=record-expense` shortcut | Opens the expense category, amount, date, and description form; closing removes the query parameter. |
| CRM, Analytics, Staff, Inventory | Load each page and inspect its dashboard controls | Data, filters, and action controls render without browser alerts. |
| Staff management | Load `/dashboard/academy/staff` | Employee edit cards, date controls, save/delete actions, and QR preview controls render. |
| Coach add-on report | Open and close **View Members (7)** | Shows member, plan, subscription period, session use, attendance, and paid amount. |
| Notifications, Attendance, Task Board, Tasks | Load each page and inspect its operational controls | Read, filtering, scanning/manual-entry, and task controls render without browser alerts. |
| Payroll, Plans, Audit, Settings | Load each page and inspect its administrative controls | Data and controls render without browser alerts. |

## Controlled live-write checks

| Flow | QA action | Verified result |
| --- | --- | --- |
| Staff creation | Created `QA Browser Rotation 20260728` through **Staff management** | The employee was persisted with employee role, EGP 6,100 base salary, and pay day 15. |
| Staff editing | Changed the QA employee base salary to EGP 6,200 and saved | Reloaded data retained the new salary and pay day. |
| Shift assignment | Assigned the QA employee to **Midday Desk 11-16** | The staff record retained the assignment and the shift's rotation preview placed the QA employee first in the next Friday off-day sequence. |
| Payroll generation | Generated July 2026 payroll after the salary update | A pending QA row used EGP 6,200 as the base salary. |
| Payroll adjustments | Saved EGP 100 bonus and EGP 50 deduction | The pending payroll net became EGP 6,250. |
| Payroll payment | Selected **Pay** for the QA row | The row became paid and its EGP 6,250 net was retained. |
| Staff QR attendance | Checked in the QA employee with its staff QR code | A late scan created the expected attendance warning because the scan was after the 11:00 shift start. |
| Warning review | Selected **Dismiss** for the QA late-warning | The warning persisted as `dismissed`, so it cannot be converted into a payroll deduction. |
| POS checkout | Sold one Energy Gel for cash as a QA walk-in sale | Stock decreased from 5 to 4 and the EGP 40 paid sale appeared in the recent-sales list. |
| POS void | Used **Void sale** on the QA sale | The sale persisted as `voided` and Energy Gel stock returned from 4 to 5. |
| Admin account creation | Created `qa.browser.20260728@gym.test`, selected Cashier, and linked the QA staff profile | The user was stored as email-verified with the Cashier role, and the staff profile now references that user account. |
| Member creation | Created `QA Browser Member 20260728` | The member appeared immediately in filtered Members results with an active profile and QR payload. |
| Subscription sale | Added **Monthly Gym 30d** to the QA member and collected EGP 600 cash | The active subscription appeared in Membership Pipeline with EGP 600 paid and a 30-day period. |
| Partial subscription refund | Used **Cancel with refund**, entered EGP 200, and provided a QA reason | The subscription became stopped, the pipeline shows **Partial refund**, EGP 200 refunded, and EGP 400 net collected. |
| Custom role lifecycle | Created a QA role with `dashboard.view`, then deleted it through the role menu | The role appeared with one permission and was removed successfully. |
| Calendar event lifecycle | Created and deleted `QA Browser Event 20260728` | The custom event appeared on the selected date and was removed through its event editor. |
| Finance expense lifecycle | Recorded an EGP 1 QA rent expense, opened **Ledger**, then deleted it | The expense affected the dashboard total, appeared in the expense ledger, and was removed successfully. |
| Task workflow | Created `QA Browser Task 20260728` and added a comment from the task detail view | The task appeared in the Planned board column and retained the QA comment. The task remains as a visible QA record because this screen has no delete action. |
| Product lifecycle and stock | Created the inactive-after-test QA product with four units, adjusted stock in twice, adjusted it back out, then toggled it inactive | Stock moved 4 → 6 → 4 as expected. Deletion was correctly blocked after stock movements, preserving inventory history; the QA product is inactive and cannot be sold. |
| Notifications | Marked the QA partial-refund operational notification as read | The notification persisted with a `read_at` timestamp. |
| Settings | Saved the current gym/attendance/bonus settings and current WhatsApp templates without changing values | Both server actions completed successfully; no operational configuration was altered. |
| Audit log | Filtered by Product and applied the filter | Only product audit events remained, including the QA inventory history, and pagination displayed `Page 1 of 1`. |
| Plan lifecycle | Created a one-day QA membership plan with one session, verified its stored category and EGP 1 price, then removed it | Valid configured categories and the entered price now persist correctly. |
| Shift desk and handover | Signed in as the QA Cashier, opened Midday Desk 11-16, then closed and submitted the matching handover count | Shift session #2 recorded the QA employee, carried the expected totals, and completed as `auto_accepted`. |

The QR record deliberately remains open for the current day. It is a QA attendance record only; the related payroll had already been paid before the scan, and the associated warning was dismissed.

## Key operating flows

### Create an employee login

1. Go to **Users** and select **Create account**.
2. Enter name, unique email, password, confirmation, and at least one dashboard role.
3. Optionally link an existing staff profile that does not already have a login.
4. Submit. The account is immediately verified and can sign in; no six-digit verification code is required.

### Check why a commission changed

1. Go to **Reports Hub → Employees** and select a date range.
2. Read the commission summary: **Earned**, **Reversed**, and **Net**.
3. Select **Details** for the employee.
4. In the ledger, positive rows are earned commission; negative rows labelled **Refund reversal** are amounts removed after a refund.

### Complete a POS sale

1. Go to **POS** and select **Checkout** (or use `/dashboard/ecommerce?action=checkout`).
2. Select an in-stock product, quantity, discount, and payment method.
3. Optionally select a member; leave it empty for a walk-in sale.
4. Add notes if needed, then select **Create sale**. This decrements stock and records payment, so it was not submitted during QA.

## Fix verified during this audit

The shared `useQueryDialog` helper now derives its open state from the URL as well as local clicks. Dashboard quick-action links, such as POS checkout, therefore open reliably on initial render instead of depending on a post-hydration effect.

The custom-role delete form is now rendered whether or not the **Edit permissions** panel is open. Before this correction, **Delete role** could appear to do nothing until that panel had been opened first.

The Action Queue now combines manual and generated task rows with a base collection. Before this correction, generated task arrays were merged into an Eloquent collection, causing the task-list API to return a 500 and leaving the queue empty.

Audit-log pagination metadata is now normalized before display. Before this correction, an unexpected metadata shape could render the footer as `Page NaN of NaN`; it now renders valid fallback page numbers.

The create-plan form now defaults to the first configured active Membership category rather than the invalid legacy `gym_access` value, and its price input is controlled so the amount shown in the commission summary is the amount submitted to the backend.

## Still intentionally unsubmitted

The following write actions still require separate, disposable test data or a deliberate business decision: creating/updating members, assigning roles, creating roles, completing/voiding POS sales, refunds, exports, bulk staff deletion, and settings saves. Existing staff shift schedules and rotation order were not changed because they affect real employees in the local dataset.
