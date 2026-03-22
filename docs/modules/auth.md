# Authentication Module (`src/modules/auth`)

The Authentication module governs all security boundaries for the Horace API, handling user registration logic, secure session verification, OTP delivery loops, and temporary token brokering for GCP resource access.

## Core Workflows

1. **User Registration & Email Verification**: 
   When users register, an OTP (One Time Password) is cleanly decoupled into the `OTP` model, and an email is dispatched. They cannot authenticate until the OTP verification is routed.
2. **Standard JWT Login**:
   Once verified, standard logins return a signed JWT token authorizing users symmetrically against the backend Rest APIs.
3. **GCP Delegation Pipeline**:
   Since the React Frontend directly interfaces with Vertex AI over some components (like raw Gemini Live sockets without backend translation), the Frontend securely asks the Auth module for a temporary, short-lived, deeply-scoped Google Cloud Platform access token. This enforces security dynamically without storing root service accounts in the browser.

## Models

- `User` (`user.model.js`): Maps to the `users` table. Heavily relies on Sequelize lifecycle hooks (e.g., `beforeSave`) to automatically bcrypt passwords, preventing plaintext leaks across developer features. Implements `toSafeJSON()` to securely rip passwords from API payloads.
- `OTP` (`otp.model.js`): Maps to the `otps` table. Exposes specialized static functions like `OTP.findValidOTP()` which enforces strict 5-minute lifespan boundaries securely via standard SQL timestamps.

## Endpoints

| Method | Route | Description | Requires Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Registers a new Unverified user account. Triggers Mail service. | - |
| `POST` | `/api/v1/auth/login` | Validates credentials and yields a signed JWT token. | - |
| `POST` | `/api/v1/auth/verify` | Evaluates a provided OTP code for a user, marking their account Verified. | - |
| `GET`  | `/api/v1/auth/token` | Generates a scoped, short-lived GCP token so the frontend can interact directly with GCP sockets. | Yes (`Bearer JWT`) |

## Associated Services
- `auth.service.js`: The underlying domain layer handling the raw database read/write logic for checking emails, creating hashes, and validating passwords securely. 
- `gcp.service.js`: Wrapper around the Google Cloud SDK exclusively utilized for fetching strict access tokens.

## Module Flowchart

```eraser
title Auth Module Diagram

User [icon: user, color: blue]
REST API [icon: globe, color: purple] {
  Register [icon: input]
  Login [icon: lock]
  GetToken [icon: key]
}
Services [icon: server, color: orange] {
  AuthService [icon: key]
  GCPService [icon: cloud]
}
Models [icon: database, color: green] {
  UsersDB [label: "Users", icon: user]
  OTPsDB [label: "OTPs", icon: key]
}
MailService [icon: mail, color: purple]

// Connections
User > Register
Register > AuthService
AuthService > OTPsDB: Save OTP
AuthService > MailService: Send Email
User > Login
Login > AuthService
AuthService > UsersDB: Verify Password
User > GetToken
GetToken > GCPService: Request Bearer Token
```
