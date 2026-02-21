# Open Bug Reporter

Esto nació por una necesidad real: en un equipo chico, perder tiempo explicando bugs por chat es carísimo.  
La idea es simple: el **Developer** captura pantalla, anota encima, y el **QA Tester** recibe un mail con contexto útil en segundos.

No pretende ser una plataforma gigante. Es una herramienta rápida para equipos que construyen y necesitan feedback claro.

## Stack
- Chrome Extension (Manifest V3)
- Firebase Cloud Functions v2 (Node.js 20)
- Resend (envío de correo)

## Estructura
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
│     ├─ index.js             # HTTP endpoint: submitBugReport
│     ├─ package.json
│     └─ .env.example
├─ dist/
├─ .firebaserc.example
└─ firebase.json
```

## Flujo Técnico (real)
1. Popup: Developer carga nombre, comentario y pasos.
2. `background.js`: captura la pestaña activa.
3. `content.js`: abre overlay para dibujar (brush + rect).
4. `content.js`: envía JSON al backend.
5. `submitBugReport`: valida payload + arma mail + adjunta PNG.

Payload actual:
- `developer`
- `comment`
- `steps`
- `pageUrl`
- `viewport`
- `imageBase64`

Nota: el frontend y backend aceptan claves legacy (`comentario`, `pasos`, etc.) para no romper despliegues a medias.

## Requisitos
- Node.js 20+
- Firebase CLI
- Proyecto Firebase con plan Blaze
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

## 2) Configurar Proyecto Firebase
```bash
cp .firebaserc.example .firebaserc
```

En `.firebaserc`, reemplazar:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

## 3) Deploy
Desde la raíz:
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
3. Click en Load unpacked
4. Seleccionar `extension/`

## Troubleshooting corto
- `Receiving end does not exist`
  - Normal después de recargar la extensión. El background intenta inyectar `content.js` en caliente.

- Error de deploy por billing/APIs
  - Activar Blaze y redeploy.

- No llega email
  - Revisar `RESEND_API_KEY`, dominio verificado y logs de function.

## Limitaciones conocidas
- Endpoint público por simplicidad. Si lo abrís a internet, agregá auth/rate-limit.
- Capturas muy grandes pueden fallar por tamaño de payload.

## License
MIT (`LICENSE`).
