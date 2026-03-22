# Mail Service (`src/modules/mail`)

The Mail service is a specialized utility module functioning as an external transporter.

## Services

- **`mail.service.js`**: Exclusively utilized as a security courier mechanism primarily bound to the `Auth` controllers. Encapsulates `nodemailer` configurations and template hydration. 
- **Workflow**: Dispatches strictly formatted, security-focused dynamic templates across standard SMTP bindings to user inboxes for critical Registration OTP boundaries, securely awaiting verification outside of the Express router's logic layer.

## Module Flowchart

```eraser
title Mail Module Diagram

AuthService [icon: key, color: purple]
Services [icon: box, color: orange] {
  MailService [icon: mail]
}
SMTP Output [icon: cloud, color: green] {
  NodeMailer [icon: send]
}

// Connections
AuthService > MailService: invoke verification pipelines
MailService > NodeMailer: Dispatch cleanly over Secure TLS
```
