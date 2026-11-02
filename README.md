# Asdaq Vista — billing website

Private monthly bills for the 10 flats of Asdaq Vista (Hulimavu, Bengaluru), by Asdaq Construction.

- **Website**: plain HTML, CSS and JavaScript, hosted free on GitHub Pages. It contains no tenant data.
- **Data**: one private Google Sheet (`Asdaq_Vista_Billing_Master.xlsx` imported into Google Sheets).
- **Bridge**: `apps-script/Code.gs`, a Google Apps Script web app. It checks every login and returns only what that person may see.

```
index.html              the whole site (one page)
assets/css/style.css    design
assets/js/config.js     ← paste the Apps Script URL here
assets/js/api.js        talks to Apps Script
assets/js/app.js        screens: home, tenant bill, owner/admin
assets/js/demo.js       sample data used while config.js has no URL
assets/img/             logo, badge, building photo, app icons
manifest.webmanifest    lets phones/computers install the site as an app
sw.js                   keeps the site's look offline (never bill data)
apps-script/Code.gs     the backend
```

## App icon

The installed app's icon is an **AV** monogram cut from the Asdaq Vista logo: the light **A** of ASDAQ and the bold **V** of VISTA, on navy (`assets/img/app-icon-512.png`, `app-icon-192.png`, `icon-180.png`, `icon-32.png`).

## Who can do what

| Login | Signs in with | Can |
| --- | --- | --- |
| Tenant | Phone + date of birth of the person named on the agreement | See only their own bills, usage and agreement |
| Owner / admin (Basheeruddin Asdaq Syed Mohammed) — the only staff login | Phone + date of birth + password (16+ characters) | Everything: add months (10 flat readings + the main meter), correct readings, change amounts for one flat, mark payments, add/edit/renew tenants, mark a flat vacated, choose which owner receives each flat's rent, answer requests |

The three rent receivers (Faiqa Nausheen, Farhana Yasmin, Emaduddin Asdaq Syed Mohammed) have no logins; they are listed in the People tab so the admin can pick who receives each flat's rent. The dashboard's Overview shows each owner's flats and monthly rent.

**Contact page:** the Contact link in the menu and footer opens a page with two choices — **Contact via WhatsApp** (Settings `whatsapp_contact`) and **Contact via Gmail** (opens a blank Gmail email in a new tab to Settings `contact_email`, sasdaq@gmail.com, plus a "Copy address" button). Only the one owner named in Settings `contact_name` is shown there.

**Date of birth is always 8 digits, day-month-year, no dashes**: 1 October 1985 → `01101985`. Type it in the sheet the same way (Tenants column E, People column F).

Every change made on the website is written to the `Change_Log` tab.

The admin password is stored as a salted SHA-256 hash in the People tab — never as typed. Wrong logins pause like a phone lock: after 5 wrong tries the login pauses for 30 seconds, the next time 5 minutes, then 15 minutes each time (a correct login resets it). Anyone with the placeholder phone `+91 0000000000` or no date of birth cannot log in.

## Safety

Built in: per-flat data only, phone-style login pauses, security alert emails (10+ wrong tries on one number, or 25 in an hour), owner auto-logout after 30 minutes idle and a 2-hour session cap, text typed on the site saved as plain text (never formulas), a Content Security Policy, and the Change_Log. After setup, run `installWeeklyBackup` once in Apps Script for a weekly copy (last 8 kept).
Keep the sheet in a dedicated Google account, shared only with the owner and Emad, General access **Restricted**. The full protocol (accounts, never-do list, monthly checks, what to do if something goes wrong) is in the "Asdaq Vista — Data Safety Protocol" document.

## Setup (about 20 minutes, once)

1. **Google Sheet**
   1. Open Google Drive → New → File upload → `Asdaq_Vista_Billing_Master.xlsx`.
   2. Open it → File → Save as Google Sheets. Keep it private (don't share the link).
   3. Fill in real phone numbers (Tenants column D, People column E) and each tenant's date of birth or PIN (Tenants column E).
2. **Apps Script**
   1. In the Google Sheet: Extensions → Apps Script. Delete the sample code, paste all of `apps-script/Code.gs`, then Save.
   2. Deploy → New deployment → type **Web app** → Execute as **Me** → Who has access **Anyone** → Deploy. Allow the permissions.
   3. Copy the Web app URL (ends with `/exec`).
3. **Website**
   1. Create the GitHub organisation (e.g. `asdaq-construction`) and a repository (e.g. `asdaq-vista-billing`).
   2. Upload everything in this folder **except** `apps-script/` (keep that private, or leave it — it holds no data or passwords).
   3. Edit `assets/js/config.js` and paste the URL: `API_URL: 'https://script.google.com/macros/s/…/exec'`.
   4. Repository → Settings → Pages → Deploy from branch → `main` / root. The site appears at `https://asdaq-construction.github.io/asdaq-vista-billing/`.
4. **First logins**
   1. Fill in phone numbers and dates of birth (8 digits) in the Tenants tab and the admin row of People. Tenants can log in straight away.
   2. Admin password: in the People tab, type any code in the admin row under "Admin only: one-time setup code".
   3. On the website: Owner login → "Set the owner password" → phone + date of birth + setup code → choose a password of 16+ characters. The code is cleared automatically.
   4. Forgot the password? The admin messages Emaduddin on WhatsApp; Emaduddin types a new setup code in the People tab (admin row) and the admin repeats step 3.
5. **Install as an app** (optional): on the live site press **Install app** in the menu. Android/desktop Chrome or Edge install straight away; on iPhone/iPad open the site in Safari → Share → **Add to Home Screen**.

When you change `Code.gs` later: Deploy → Manage deployments → edit → Version: New version → Deploy. The URL stays the same.

## Due dates and payments

- **Rent** is due every month on the day the tenant's agreement started (Tenants tab, last column). It turns red **Overdue** 2 days after that.
- **Electricity + common maintenance** are due on the **1st of the following month** for everyone (from 1 Oct 2026). Overdue after 3 days.
- **Recording a payment:** on Monthly bills, press **Paid** next to the flat. Today's date is saved (date only, no time). 
  - **Different amount:** type the amount received. Less → "₹X left" (red "₹X overdue" after the grace days), with **Waive the rest** if you don't want to collect it. More → "Overpaid ₹X", which the tenant sees on their bill.
  - **Clear this payment** undoes a mistake.
- Grace days are set in Settings (`utilities_grace_days`, `rent_grace_days`) and are never shown to tenants.

## Maintenance, the meters and new months

- **Maintenance costs** (website tab, or the `Maintenance_Costs` sheet) hold the standing list:
  - **Fixed** items are the same every month: watchman salary, lift, CCTV & internet, BBMP garbage.
  - **Varies** items are typed each month: generator, water bill, cleaning.
  - **Common electricity** is worked out automatically.
- **Add month** asks for the **10 flat readings and the main meter** (the whole building's incoming line) and the varying amounts, plus any one-off repair. Last month's readings fill in automatically (October's main meter, 45,708.7, is already in the sheet). **Common units = main meter units − all 10 flats' units**; common electricity and each flat's maintenance share (÷ 10) follow automatically.

## Arshad's account

Owner dashboard → **Arshad's account** (sheet tab `Arshad_Account`), month by month:
- **Collected from tenants:** electricity + maintenance received, from the Paid marks in the month tab (and what is still due).
- **Payments:** each bill and salary — BESCOM main meter bill (commercial rate), water bill, watchman, lift, CCTV, garbage, generator, cleaning, repairs — with **Paid by Arshad / Paid by you** and a one-tap **Paid today**. Only Arshad's payments count against his collections. The list is created automatically when a month is added (or with "Create this month's list").
- **His fee:** ₹35,000 a month (Settings `arshad_monthly_fee`).
- **Balance:** collected − paid by Arshad − fee + money you gave him − money he gave back, carried forward from month to month (start: Settings `arshad_opening_balance`). The screen says "You owe Arshad ₹X" or "Arshad holds ₹X of yours".
- **Electricity gap:** the commercial BESCOM bill compared with what tenants were charged at domestic rates; the difference is what you cover.

## Settings on the website (owner)

The **Settings** tab on the owner dashboard edits the sheet's Settings without opening it:
- **Electricity meters:** *Private meters* (10 flat meters + the main meter, billed here) or *BESCOM meters* (each flat pays BESCOM directly). In BESCOM mode, Add month asks for no readings, only the common area's BESCOM bill (added to maintenance); new months bill no electricity; each tenant's bill shows their flat's **BESCOM account ID** and **RR / meter number** (Flats tab) with a link to the BESCOM website. Switching back to private meters asks once for the starting readings.
- **Electricity tariff:** fixed charge, energy, FPPCA, P&G surcharge, tax. New rates apply to the next month added; months already added keep their own rates.
- Due day and grace days, renewal %, maintenance rounding, terrace charge, WhatsApp / contact email / alert email, months of data kept.

## Data kept: 24 months

`cleanupOldData` runs on the 2nd of each month (after `installAllAutomations`): it saves a backup copy first, then removes month tabs, finished requests, change-log lines and tenants who left more than `keep_months` (24) months ago. The 2 newest month tabs are always kept. Weekly backups keep the 8 newest copies; older copies go to Google Drive's bin, which Google empties after 30 days.

**After setup, run `installAllAutomations` once** in the Apps Script editor: daily summary email, weekly backup, monthly clean-up.

## Event permission and email alerts

- Tenants open **Event permission** (after logging in) to ask permission for anything that may disturb others — a wedding, function, terrace lighting, loud music and so on — with the date and the time from/to. The admin approves or declines in the **Requests** tab; the tenant sees the answer and any message. There is no complaints form; tenants use the Contact page.
  - Tenants must say whether the event is in the **Day**, at **Night**, or **Day and night** (times after 10 pm or before 6 am count as night), and whether it **could disturb neighbours**. There are no fixed quiet hours, but anything at night or noisy has to be mentioned.
  - **Terrace use:** a small cleaning charge (Settings `terrace_cleaning_charge`, ₹500), paid to the owner.
  - **Outside / terrace lighting** runs on the common meter: when approving, the owner types a one-time lighting charge. Charges show on the request for both the tenant and the owner, and in the Requests tab (columns P–Q).
- **Agreement ending:** in the last 2 months of an agreement the tenant sees a pop-up asking whether they will continue or move out. The answer appears in Requests (and by email).
- **Tenant leaving / new tenant:** Tenants tab → **Mark vacated** (saves the move-out date), then **Add tenant** for the new one.
- **Telling the tenant the answer:** the tenant sees the answer (and charges) at the top of their bill page the next time they open the site, until they close it. After approving or declining, the owner can also tap **Tell on WhatsApp** on the request — WhatsApp opens with the message ready to that tenant's phone; he just presses Send.
- **Email alerts to the owner (free):** type the admin's Gmail address in Settings → `admin_email`.
  - Every new request sends an email straight away.
  - For a daily 8 am summary of overdue payments and waiting requests, open the Apps Script editor once, choose `installDailySummary` in the function menu and press **Run**.
  - Emails are sent from the Google account that owns the sheet. Gmail allows about 100 such emails a day, far more than needed.

## Each month

On the website as admin: **Add month** → type the 10 flat readings and the main meter reading, the reading date/time and this month's varying costs → check the bills on **Monthly bills** → tap any flat to fix a reading, change the days billed, or set a different amount → **Publish**.

Special cases (tenant moving mid-month, agreed rent different from 5%, two tenants in one month) are explained in the sheet's **Start Here** tab.

## Demo

With `API_URL` empty the site runs on fictional sample data:
- Tenant: phone `98765000` + the flat's position and date of birth `0101198` + the same digit (S2 = `9876500006` / `01011986`).
- Admin: phone `9000000000`, date of birth `01011960`, password `asdaq-demo-password`.
