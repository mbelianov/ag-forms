# Sending Reports by Email — Setup Guide for Doctors

Reports are sent from **your own mailbox** (Gmail, Yahoo or another SMTP server), so the patient sees your address as the sender. You set this up once on the **Email Settings** page (user menu → *Email Settings*, address `/email-settings`). Doctors and admins can use it; viewers cannot.

## Use an app password, not your normal password

Gmail and Yahoo do not accept your normal password from other applications. You create a separate 16-character **app password** at the provider and paste it into Email Settings.

- Do **not** enter your normal mailbox password.
- The app password is stored encrypted on the server and is never shown again after saving. The form shows only that a password is saved.
- You can revoke an app password at any time at the provider without changing your mailbox password.

## Gmail

1. Sign in to your Google Account → **Security** and make sure **2-Step Verification** is turned on (needed once, on Google's website).
2. Open **App passwords** (Google Account → Security → 2-Step Verification → App passwords) and create one, for example named "Ultrasound app".
3. Copy the 16-character password Google shows. Spaces are ignored.
4. In the app: **Email Settings** → provider **Google** → enter your Gmail address and paste the app password → **Save**.
5. Press **Send test email**. A message should arrive in your own inbox.

## Yahoo

1. Sign in to Yahoo → **Account Info** → **Account security** and turn on two-step verification if it is not on yet.
2. Choose **Generate app password**, enter a name such as "Ultrasound app" and copy the generated password.
3. In the app: **Email Settings** → provider **Yahoo** → enter your Yahoo address and paste the app password → **Save**.
4. Press **Send test email**.

## Other providers (Generic SMTP)

Choose **Generic** and enter the server name, port, connection security (STARTTLS or SSL/TLS), user name and password given by your mail provider. Only public mail servers are accepted; local and private network addresses are rejected. Outlook / Microsoft 365 has no preset and works only if your account still allows app-password SMTP sign-in.

## Sending a report

Open an examination → **Email Report**. The recipient is pre-filled from the patient's email address; you can change it (the change is recorded in the audit log). Drafts can be sent too, with a warning. You never type a verification code or password when sending.

## If something goes wrong

| Message | What to do |
|---------|-----------|
| "Configure your email provider" | Open Email Settings and save your provider and app password first. |
| Login rejected (authentication failed) | The app password is wrong or was revoked. Create a new app password and save it again. |
| Could not connect | Check the server, port and security setting (Generic) and try again later. |
| Recipient rejected | Check the patient's email address. |
| "Email settings are temporarily unavailable" | A server configuration problem; tell the administrator. |

"Sent" means the mail server accepted the message. It does not guarantee the patient received it, and the PDF is not password protected; it also stays in your Sent folder.

Administrators: see `README-SWA.md` (encryption key setup and rotation) and `05-deployment-guide.md`.
