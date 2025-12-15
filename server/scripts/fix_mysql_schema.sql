-- Actualizar esquema de MySQL para compatibilidad con MongoDB ObjectIds

USE videoconferencia;

-- Modificar columna creador para aceptar ObjectIds de MongoDB (strings)
ALTER TABLE salas MODIFY COLUMN creador VARCHAR(100);

-- Verificar cambios
DESCRIBE salas;
