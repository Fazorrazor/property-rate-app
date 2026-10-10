import pg from "pg";
const { Client } = pg;

import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' 
    ORDER BY table_name;
  `);
  console.log("=== ALL TABLES IN DB ===");
  console.log(tablesRes.rows.map(r => r.table_name));

  const colsRes = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema='public' 
      AND (column_name ILIKE '%pay%' 
        OR column_name ILIKE '%paid%' 
        OR column_name ILIKE '%receipt%'
        OR column_name ILIKE '%fee%')
    ORDER BY table_name, column_name;
  `);
  console.log("\n=== PAYMENT / FEE / PAID / RECEIPT COLUMNS IN DB ===");
  console.log(colsRes.rows);

  // Check row counts of payment/transaction tables
  console.log("\n=== ROW COUNTS OF PAYMENT/TRANSACTION TABLES ===");
  for (const t of ["FeePayments", "FeePayment", "Transaction", "Receipt", "PaidUserRecord", "AdjustArrears", "CollectorsCommPmts", "tmpbill"]) {
    try {
      const cnt = await client.query(`SELECT COUNT(*) FROM "${t}";`);
      console.log(`Table "${t}": ${cnt.rows[0].count} rows`);
    } catch (e) {
      console.log(`Table "${t}": NOT FOUND (${e.message})`);
    }
  }

  // Check if PR-011-001350 appears in ANY of these tables
  console.log("\n=== SEARCH PR-011-001350 ACROSS TABLES ===");
  for (const t of ["FeePayments", "FeePayment", "Transaction", "Receipt", "PaidUserRecord", "AdjustArrears"]) {
    try {
      // Find which column has accountNo or accountNumber
      const col = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name='${t}' AND (column_name ILIKE '%account%' OR column_name ILIKE '%prop%');
      `);
      for (const c of col.rows) {
        const match = await client.query(`SELECT * FROM "${t}" WHERE "${c.column_name}"::text ILIKE '%PR-011-001350%';`);
        if (match.rows.length > 0) {
          console.log(`FOUND in table "${t}" column "${c.column_name}":`, match.rows);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  await client.end();
}

run();
