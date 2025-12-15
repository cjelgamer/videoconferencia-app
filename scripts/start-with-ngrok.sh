#!/bin/bash

# Script para configurar ngrok y habilitar video en red

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== Configuración de Video para Red Local ===${NC}\n"

# Verificar si ngrok está instalado
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}❌ ngrok no está instalado${NC}\n"
    echo -e "${YELLOW}Instalando ngrok...${NC}"
    
    # Intentar instalar con snap
    if command -v snap &> /dev/null; then
        echo -e "${BLUE}Instalando con snap...${NC}"
        sudo snap install ngrok
    else
        echo -e "${RED}❌ snap no disponible${NC}"
        echo -e "${YELLOW}Por favor instala ngrok manualmente:${NC}"
        echo "  1. Ve a: https://ngrok.com/download"
        echo "  2. Descarga ngrok para Linux"
        echo "  3. Extrae y mueve a /usr/local/bin/"
        echo ""
        echo "O usa snap:"
        echo "  sudo snap install ngrok"
        exit 1
    fi
fi

echo -e "${GREEN}✅ ngrok está instalado${NC}\n"

# Verificar si el frontend está corriendo
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  El frontend no está corriendo en puerto 3000${NC}"
    echo -e "${YELLOW}Inicia el frontend primero:${NC}"
    echo "  cd client && npm start"
    echo ""
    read -p "¿Ya está corriendo el frontend? (s/n): " respuesta
    if [[ ! "$respuesta" =~ ^[Ss]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}=== Iniciando túnel ngrok ===${NC}\n"
echo -e "${YELLOW}Esto creará una URL HTTPS pública para tu aplicación${NC}"
echo -e "${YELLOW}Comparte la URL que aparezca con los participantes${NC}\n"

echo -e "${BLUE}Presiona Ctrl+C para detener ngrok${NC}\n"

# Iniciar ngrok
ngrok http 3000
