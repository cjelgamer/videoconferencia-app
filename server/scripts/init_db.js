const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "",
    multipleStatements: true // Allow multiple queries
});

const sql = `
  CREATE DATABASE IF NOT EXISTS videoconferencia DEFAULT CHARACTER SET = 'utf8mb4';
  USE videoconferencia;

  CREATE TABLE IF NOT EXISTS usuarios(
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    email VARCHAR(100)
);

  CREATE TABLE IF NOT EXISTS salas(
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id VARCHAR(20),
    creador INT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

connection.connect((err) => {
    if (err) {
        console.error("❌ Link Error:", err.message);
        process.exit(1);
    }
    console.log("✅ Connected to MySQL.");

    connection.query(sql, (err, results) => {
        if (err) {
            console.error("❌ SQL Error:", err.message);
            process.exit(1);
        }
        console.log("✅ Database and tables created successfully.");
        connection.end();
    });
});

