
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const { Pool, types } = pkg;

types.setTypeParser(1082, (val) => val);

const pool = new Pool({
    connectionString: process.env.DB_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on("connect", () => {
    console.log("DB connected");
});

pool.on("error", (err) => {
    console.error("Database error:", err.message);
});

export default pool;
