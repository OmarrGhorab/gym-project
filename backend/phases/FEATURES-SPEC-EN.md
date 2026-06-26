# Missing Features Specification

---

## 1. Assigning a Role to an Employee

**Goal:**
After the admin creates roles and permissions, they should be able to assign each employee to their appropriate role.

**Flow:**
- From the Employees page or the Roles page, the admin selects an employee and assigns them one or more roles
- The employee then sees only the parts of the system they are permitted to access

**Note:**
Currently roles and permissions can be created, but there is no way to link an employee to a role from within the UI.

---

## 2. Sale Receipt

**Goal:**
After any sale, the staff member can print or download a receipt for the customer.

**Flow:**
- On the POS screen after completing a purchase, a "Print Receipt" or "Download PDF" button appears
- The same button should be available in the Sales page on each row

**Receipt contents:**
- Gym name and logo
- Customer info
- Items purchased, quantities, and prices
- Total and payment method
- Date, time, and receipt number

---

## 3. Sales Period Report

**Goal:**
The admin can view a detailed sales report for any time period they choose.

**Contents:**
- Total sales in the period
- Details of each transaction (product, quantity, price, seller, date)
- Ability to filter by seller or product

**Note:**
Currently the Reports page has a general financial report and an employee performance report, but no dedicated detailed sales report.

---

## 4. Payslip

**Goal:**
Each employee or admin can download a monthly salary slip as a PDF.

**Flow:**
- On the Payroll page, each payroll row has a "Download Payslip" button

**Payslip contents:**
- Employee name and job title
- Base salary
- Commissions and bonuses
- Deductions
- Net salary
- Month and payment date

---

## 5. Member Payment History

**Goal:**
When the admin opens a member's profile, they can see all payments recorded for that member from day one until now.

**Contents:**
- All subscription payments (date, amount, status)
- All product purchases
- Total paid and outstanding balance

**Note:**
Currently the member details page only shows basic info and the latest subscription — there is no full financial history for the member.

---

## 6. Delete a Plan

**Goal:**
The admin can delete a plan they no longer need.

**Flow:**
- A delete button on each plan row in the table
- A confirmation prompt before deletion
- If the plan has active subscriptions, show a warning or block the deletion

---

## 7. Add a Subscription for an Existing Member

**Goal:**
The admin can add a new subscription to an already-registered member without having to create them as a new member.

**Flow:**
- On the Subscriptions page, a "New Subscription" button opens a form with:
  - Select member by name or ID
  - Select plan
  - Start and end dates
  - Amount paid

**Note:**
Currently a subscription is only created when adding a new member. If an existing member's subscription expires, there is no clear way to renew or add a new one from the Subscriptions page.

---

## 8. Export Status and File Download

**Goal:**
When a user requests a data export (members, sales, etc.), they can see the export progress and download the file once it is ready.

**Flow:**
- User clicks "Export"
- A progress indicator appears showing the export is in progress
- Once complete, a "Download File" button appears

**Note:**
Currently the export button exists but after clicking it nothing follows — no status tracking and no file download. The export feature does not actually work end-to-end.

---

## 9. Individual Employee Performance Report

**Goal:**
The admin can open an employee's profile and view their detailed performance for any selected period.

**Contents:**
- Number of subscriptions sold
- Sales volume (products)
- Commissions earned
- Comparison with previous months

**Note:**
Currently reports only show all employees together. There is no way to view a single employee's detailed performance.

---

## 10. Attendance Tracking

**Goal:**
Attendance tracking serves two types of users at the gym:

---

### 10a. Employee Attendance

**Goal:**
Record each employee's check-in and check-out time every day and link it to monthly reports.

**Flow:**
- Each day, attendance and departure times are recorded for every employee
- Status options: Present / Absent / On leave / Late
- Optional notes (e.g. reason for absence)
- Monthly reports show each employee's attendance summary



---

### 10b. Member Attendance (Gym Visits)

**Goal:**
Record every time a member enters the gym, linked to their active subscription.

**Flow:**
- When a member arrives, their entry time is recorded (and optionally their exit time)
- If their subscription is expired or suspended, an instant alert appears
- The member's profile shows a full history of their visits


---

## Missing Filters in Existing Pages

| Page | Missing Filter |
|------|---------------|
| Sales | Filter by seller (which employee made the sale) |
| Payments | Filter to show outstanding dues independently |
| Commissions | Filter by commission status (paid / pending) |
