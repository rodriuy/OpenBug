# Open Bug Reporter

[English](README.md) | Español

Esta herramienta nació de un problema real de equipo: reportar bugs por chat suele perder contexto y hace más lento todo el ciclo.
Con Open Bug Reporter, un **QA Tester** puede capturar y anotar la pantalla, y el **Developer** recibe el reporte por email en segundos.

La idea es mantenerlo simple: reportes rápidos, contexto claro y setup corto.

## Stack
- Extensión de Chrome (Manifest V3)
- Firebase Cloud Functions v2 (Node.js 20)
- Resend (envío de correo)

## Estructura del Proyecto
```text
.
├─ extension/
│  ├─ manifest.json
│  ├─ background.js
│  ├─ content.js
│  ├─ popup.html
│  ├─ popup.css
│  ├─ popup.js
│  ├─ config.js
│  └─ config.example.js
├─ firebase/
│  └─ functions/
│     ├─ index.js             # Endpoint HTTP: submitBugReport
│     ├─ package.json
│     └─ .env.example
├─ dist/
├─ .firebaserc.example
└─ firebase.json
```

## Flujo Real
1. Quien reporta abre el popup y completa nombre, comentario y pasos (opcional).
2. `background.js` captura screenshot de la pestaña activa.
3. `content.js` abre un overlay full-screen para anotar (brush + rectángulo).
4. `content.js` envía JSON al backend.
5. `submitBugReport` valida el payload y envía email con PNG adjunto.

Payload actual:
- `developer`
- `comment`
- `steps`
- `pageUrl`
- `viewport`
- `imageBase64`

Nota de compatibilidad: frontend y backend aceptan claves legacy (`comentario`, `pasos`, etc.) para no romper despliegues en transición.

## Requisitos
- Node.js 20+
- Firebase CLI
- Proyecto Firebase en plan Blaze
- Dominio verificado en Resend (`your-domain.com`)

## 1) Configurar Functions
```bash
cd firebase/functions
npm install
cp .env.example .env
```

Editar `.env`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
QA_REPORT_TO=YOUR_EMAIL@example.com
QA_REPORT_FROM=Open Bug Reporter <no-reply@your-domain.com>
```

`QA_REPORT_TO` es el mailbox que recibe reportes (normalmente una casilla del equipo de desarrollo).

## 2) Configurar Proyecto Firebase
```bash
cp .firebaserc.example .firebaserc
```

Después, reemplazar el project id en `.firebaserc`:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

## 3) Deploy
Desde la raíz del repo:
```bash
firebase login
firebase deploy --only functions:submitBugReport
```

Logs:
```bash
firebase functions:log --only submitBugReport
```

## 4) Configurar Extensión
```bash
cp extension/config.example.js extension/config.js
```

Editar `extension/config.js`:
```js
export const APP_CONFIG = {
  functionUrl: "https://us-central1-your-project-id.cloudfunctions.net/submitBugReport"
};
```

## 5) Cargar en Chrome
1. Ir a `chrome://extensions`
2. Activar Developer mode
3. Hacer click en Load unpacked
4. Seleccionar `extension/`

## Troubleshooting
- `Receiving end does not exist`
  - Es común justo después de recargar la extensión. El background intenta inyectar `content.js` en runtime.

- Falla el deploy por billing/APIs
  - Activar Blaze y volver a desplegar.

- No llega el email
  - Verificar `RESEND_API_KEY`, estado del dominio en Resend y logs de la function.

## Limitaciones Conocidas
- El endpoint queda público por defecto. Si lo exponés a internet, agregá auth/rate-limit.
- Capturas muy grandes pueden fallar por límites de tamaño de payload.

## Licencia
MIT (`LICENSE`).
