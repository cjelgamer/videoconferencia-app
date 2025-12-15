# Sistema de Videoconferencia Grupal

Sistema completo de videoconferencia multi-usuario con chat en tiempo real, compartir PDF, compartir pantalla, y detección de quien habla.

## 🚀 Características

- ✅ **Códigos de Reunión**: Crear y unirse con códigos únicos
- ✅ **Controles A/V**: Activar/desactivar micrófono y cámara
- ✅ **PDF Compartido**: Subir y navegar PDFs sincronizados para todos
- ✅ **Compartir Pantalla**: Compartir tu pantalla con los participantes
- ✅ **Chat en Tiempo Real**: Mensajes persistentes con MongoDB
- ✅ **Login Simple**: Autenticación con JWT
- ✅ **Indicador de Quien Habla**: Border verde cuando alguien habla
- ✅ **Multi-Usuario**: Soporte para 3+ participantes simultáneos

## 📋 Requisitos Previos

- Node.js (v14+)
- MongoDB (instalado y corriendo)
- MySQL (con base de datos `videoconferencia`)

## ⚙️ Instalación

Las dependencias ya están instaladas. Si necesitas reinstalar:

```bash
# Backend
cd server
npm install

# Frontend
cd client
npm install
```

## 🔧 Configuración

### 1. MongoDB

```bash
# Verificar si está corriendo
systemctl is-active mongodb

# Iniciar si no está activo
sudo systemctl start mongodb
```

### 2. Variables de Entorno

El archivo `server/.env` ya está configurado:
```env
MONGODB_URI=mongodb://localhost:27017/videoconferencia
JWT_SECRET=tu_secreto_super_seguro_cambialo_en_produccion
MYSQL_HOST=127.0.0.1
MYSQL_USER=root
MYSQL_PASSWORD=cristian
MYSQL_DATABASE=videoconferencia
PORT=5000
UPLOAD_DIR=./uploads
```

## 🚀 Inicio Rápido

### Opción 1: Script Automático

```bash
./scripts/start.sh
```

### Opción 2: Manual

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

La aplicación se abrirá en `http://localhost:3000`

## 📖 Cómo Usar

### 1. Registro/Login
1. Abre `http://localhost:3000`
2. Regístrate con nombre, email y contraseña
3. O inicia sesión si ya tienes cuenta

### 2. Crear Reunión
1. Haz clic en "🎥 Nueva Reunión"
2. Copia el código generado
3. Compártelo con otros participantes

### 3. Unirse a Reunión
1. Haz clic en "📱 Unirse a Reunión"
2. Ingresa el código de 8 caracteres
3. Haz clic en "Unirse"

### 4. En la Sala

**Controles:**
- 🎤 **Micrófono**: Activar/desactivar audio
- 📹 **Cámara**: Activar/desactivar video
- 🖥️ **Compartir Pantalla**: Compartir tu pantalla
- 📄 **Subir PDF**: Compartir un PDF con todos
- 💬 **Chat**: Enviar mensajes en tiempo real

**Indicador de Quien Habla:**
- Border verde aparece cuando alguien habla
- Se detecta automáticamente usando el micrófono

**PDF Compartido:**
- Todos ven la misma página
- Cualquiera puede cambiar de página
- Los cambios se sincronizan instantáneamente

## 🏗️ Estructura del Proyecto

```
Videoconferencia-app/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Login, Home, Room
│   │   ├── context/       # AuthContext
│   │   └── hooks/         # useAudioLevel
│   └── package.json
├── server/                 # Backend Node.js
│   ├── src/
│   │   ├── models/        # MongoDB models
│   │   ├── controllers/   # Business logic
│   │   ├── routes/        # API routes
│   │   └── db/            # Database connections
│   ├── uploads/           # PDFs subidos
│   └── package.json
└── scripts/
    └── start.sh           # Script de inicio
```

## 🔍 Solución de Problemas

### MongoDB no conecta
```bash
sudo systemctl start mongodb
# Verificar
systemctl is-active mongodb
```

### Videos no se ven
- Verifica permisos de cámara/micrófono en el navegador
- Usa localhost o HTTPS (requerido por WebRTC)

### PDF no carga
- Verifica que `server/uploads/` existe
- Tamaño máximo: 10MB

## 🛠️ Tecnologías Utilizadas

### Backend
- Node.js + Express
- Socket.IO (WebRTC signaling, chat, eventos)
- MongoDB + Mongoose (chat, rooms, PDFs)
- MySQL (usuarios, salas)
- JWT + bcrypt (autenticación)
- Multer (upload de PDFs)

### Frontend
- React 18
- React Router
- Socket.IO Client
- Simple Peer (WebRTC)
- Web Audio API (detección de voz)

## 📝 Notas

- El sistema usa WebRTC P2P para video/audio
- Los mensajes de chat se guardan en MongoDB
- Los PDFs se almacenan en `server/uploads/`
- La detección de voz usa Web Audio API
- Funciona en red local (LAN) automáticamente

## 🎯 Próximos Pasos

- [ ] Agregar STUN/TURN servers para producción
- [ ] Implementar grabación de sesiones
- [ ] Agregar whiteboard colaborativo
- [ ] Mejorar UI/UX con más controles
- [ ] Implementar límite de participantes por sala

## 📄 Licencia

Proyecto educacional - 7mo Semestre Lenguajes de Programación
