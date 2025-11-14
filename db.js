import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const db = mysql.createConnection({
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 3306,
  user: process.env.DATABASE_USER || 'root',         // your MySQL username
  password: process.env.DATABASE_PASSWORD || '',         // your MySQL password
  database: process.env.DATABASE_NAME || 'wetrade',      // your MySQL database name
  multipleStatements: true
});

db.connect((err) => {
  if (err) throw err;
  console.log("✅ Connected to MySQL database");
});

export default db;