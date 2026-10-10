import pg from "pg";
const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
await client.connect();
const res = await client.query('SELECT COUNT(*) FROM "Property";');
console.log("Connected successfully! Property count:", res.rows[0].count);
await client.end();
