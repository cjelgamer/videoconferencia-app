#!/bin/bash

# Script completo para iniciar videoconferencia con ngrok

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Sistema de Videoconferencia - Inicio ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}\n"

# Paso 1: Verificar ngrok
echo -e "${YELLOW}[1/4] Verificando ngrok...${NC}"
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}❌ ngrok no está instalado${NC}"
    echo -e "${YELLOW}Instalando ngrok...${NC}"
    sudo snap install ngrok
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error instalando ngrok. Instálalo manualmente:${NC}"
        echo "  sudo snap install ngrok"
        exit 1
    fi
fi
echo -e "${GREEN}✅ ngrok instalado${NC}\n"

# Paso 2: Verificar MongoDB
echo -e "${YELLOW}[2/4] Verificando MongoDB...${NC}"
if systemctl is-active --quiet mongodb || systemctl is-active --quiet mongod; then
    echo -e "${GREEN}✅ MongoDB corriendo${NC}\n"
else
    echo -e "${YELLOW}Iniciando MongoDB...${NC}"
    sudo systemctl start mongodb 2>/dev/null || sudo systemctl start mongod 2>/dev/null
    sleep 2
fi

# Paso 3: Iniciar Backend
echo -e "${YELLOW}[3/4] Iniciando Backend...${NC}"
cd server
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✅ Backend iniciado (PID: $BACKEND_PID)${NC}"
cd ..

# Esperar a que el backend inicie
sleep 3

# Paso 4: Iniciar Frontend
echo -e "${YELLOW}[4/4] Iniciando Frontend...${NC}"
cd client
npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✅ Frontend iniciado (PID: $FRONTEND_PID)${NC}"
cd ..

# Esperar a que el frontend compile
echo -e "${YELLOW}Esperando a que el frontend compile...${NC}"
sleep 10

# Verificar que el frontend esté corriendo
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${RED}❌ El frontend no respondió${NC}"
    echo -e "${YELLOW}Revisa los logs en frontend.log${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Frontend listo${NC}\n"

# Iniciar ngrok
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Iniciando túnel ngrok           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}Esto creará una URL HTTPS pública${NC}"
echo -e "${BLUE}Comparte la URL con los participantes${NC}\n"

echo -e "${YELLOW}PIDs de procesos:${NC}"
echo -e "  Backend: ${BACKEND_PID}"
echo -e "  Frontend: ${FRONTEND_PID}"
echo ""
echo -e "${YELLOW}Para detener todo:${NC}"
echo -e "  kill ${BACKEND_PID} ${FRONTEND_PID}"
echo -e "  O presiona Ctrl+C aquí"
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}\n"

# Trap para limpiar al salir
trap "echo -e '\n${YELLOW}Deteniendo servicios...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Iniciar ngrok (esto bloqueará hasta que se presione Ctrl+C)
ngrok http 3000
