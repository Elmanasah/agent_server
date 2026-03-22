# Global Services Modules (`src/modules/image` & `src/modules/mail`)

These smaller, isolated boundary systems act as specialized, single-purpose utilities executed programmatically via the global event loops. They hold no internal state.

## Image Service (`src/modules/image`)

- **`image.service.js`**: Integrates deeply with Vertex AI's `Imagen3` diffusion architecture. 
- **Workflow**: Called almost exclusively via the internal `generate_image` tool loop dispatched arbitrarily by the `LiveAgentSession` when users request illustrations via voice. Returns standardized URLs that the Browser Agent renders into the Canvas Workspace interactively.

## Module Flowchart (Image Service)

```eraser
title Image Module Diagram

LiveAgent [icon: cpu, color: purple]
Services [icon: box, color: orange] {
  ImageService [icon: image]
}
Cloud Infrastructure [icon: cloud, color: green] {
  Imagen3 [icon: star]
  GCS [label: "Cloud Storage", icon: database]
}

// Connections
LiveAgent > ImageService: generate_image(prompt)
ImageService > Imagen3: Vertex AI image completion
Imagen3 > ImageService: Rendered PNG Buffer
ImageService > GCS: Persist unauthenticated public Blob
ImageService > LiveAgent: Yield public URL
```

## Mail Service (`src/modules/mail`)

- **`mail.service.js`**: Exclusively utilized as a security courier mechanism via `Auth`. Encapsulates `nodemailer` standard SMTP bindings. 
- **Workflow**: Dispatches strictly formatted, security-focused dynamic templates for Registration OTPs loops, handling potential network timeouts securely outside of the Express router's strict timeout bounds.

## Module Flowchart (Mail Service)

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
AuthService > MailService: sendOTP(email, template)
MailService > NodeMailer: Dispatch formatting over network
```
