#!/bin/bash

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Iniciando Sistema de Videoconferencia ===${NC}\n"

# Verificar MongoDB
echo -e "${YELLOW}Verificando MongoDB...${NC}"
if systemctl is-active --quiet mongodb || systemctl is-active --quiet mongod; then
    echo -e "${GREEN}✅ MongoDB está corriendo${NC}"
else
    echo -e "${RED}❌ MongoDB no está corriendo${NC}"
    echo -e "${YELLOW}Intentando iniciar MongoDB...${NC}"
    sudo systemctl start mongodb 2>/dev/null || sudo systemctl start mongod 2>/dev/null
    sleep 2
    if systemctl is-active --quiet mongodb || systemctl is-active --quiet mongod; then
        echo -e "${GREEN}✅ MongoDB iniciado exitosamente${NC}"
    else
        echo -e "${RED}⚠️  No se pudo iniciar MongoDB automáticamente${NC}"
        echo -e "${YELLOW}Por favor, inicia MongoDB manualmente:${NC}"
        echo "  sudo systemctl start mongodb"
        echo "  # o"
        echo "  sudo systemctl start mongod"
    fi
fi

echo ""

# Verificar MySQL
echo -e "${YELLOW}Verificando MySQL...${NC}"
if systemctl is-active --quiet mysql || systemctl is-active --quiet mariadb; then
    echo -e "${GREEN}✅ MySQL está corriendo${NC}"
else
    echo -e "${YELLOW}⚠️  MySQL no está corriendo (opcional)${NC}"
fi

echo ""
echo -e "${GREEN}=== Iniciando Servidores ===${NC}\n"

# Iniciar backend en background
echo -e "${YELLOW}Iniciando Backend (puerto 5000)...${NC}"
cd server
npm run dev &
BACKEND_PID=$!
cd ..

# Esperar un poco para que el backend inicie
sleep 3

# Iniciar frontend
echo -e "${YELLOW}Iniciando Frontend (puerto 3000)...${NC}"
cd client
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ Servidores iniciados${NC}"
echo -e "Backend PID: $BACKEND_PID"
echo -e "Frontend PID: $FRONTEND_PID"
echo ""
echo -e "${GREEN}La aplicación se abrirá en: http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Para detener los servidores:${NC}"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo -e "${YELLOW}O presiona Ctrl+C${NC}"

# Esperar a que el usuario presione Ctrl+C
wait
