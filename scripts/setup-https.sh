#!/bin/bash

# Script para configurar HTTPS en desarrollo local

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Configurando HTTPS para Desarrollo Local ===${NC}\n"

# Obtener IP local
IP=$(hostname -I | awk '{print $1}')
echo -e "${YELLOW}Tu IP local es: ${GREEN}$IP${NC}\n"

# Crear directorio SSL
cd client
mkdir -p ssl

echo -e "${YELLOW}Generando certificado SSL auto-firmado...${NC}"

# Generar certificado
openssl req -x509 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=$IP" \
  2>/dev/null

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Certificado generado exitosamente${NC}\n"
else
  echo -e "${RED}❌ Error generando certificado${NC}"
  echo -e "${YELLOW}¿Tienes openssl instalado?${NC}"
  echo "  sudo apt install openssl"
  exit 1
fi

# Crear archivo .env para React
echo -e "${YELLOW}Configurando variables de entorno...${NC}"
cat > .env << EOF
HTTPS=true
SSL_CRT_FILE=ssl/cert.pem
SSL_KEY_FILE=ssl/key.pem
EOF

echo -e "${GREEN}✅ Configuración completada${NC}\n"

echo -e "${GREEN}=== Instrucciones ===${NC}"
echo -e "1. Reinicia el frontend:"
echo -e "   ${YELLOW}cd client && npm start${NC}"
echo ""
echo -e "2. Accede desde:"
echo -e "   • Este equipo: ${GREEN}https://localhost:3000${NC}"
echo -e "   • Red local: ${GREEN}https://$IP:3000${NC}"
echo ""
echo -e "${YELLOW}⚠️  El navegador mostrará una advertencia de seguridad.${NC}"
echo -e "   Haz clic en 'Avanzado' → 'Continuar de todos modos'"
echo ""
echo -e "${GREEN}¡Ahora el video y audio funcionarán en red local!${NC}"
