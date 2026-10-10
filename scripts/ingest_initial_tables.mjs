import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://jzezuitkenrfkzrkphiz.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const filePath = "c:\\Users\\PC\\OneDrive\\Documents\\DOCS\\coding\\PROJECTS\\SYSTEMS\\property-rate-app\\docs\\DB\\rmms_kpone2020_30092026 - updated";
const buffer = fs.readFileSync(filePath);
const buf = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

const PAGE = 8192;
const BASE = 512;

const byAu = new Map();
for (let o = BASE; o + PAGE <= buf.length; o += PAGE) {
  if (buf[o] !== 1 || buf[o + 1] !== 1) continue;
  const high = BigInt(view.getUint16(o + 6, true));
  const low = BigInt(view.getUint32(o + 24, true));
  const au = (high << 48n) | (low << 16n);
  if (!byAu.has(au)) byAu.set(au, []);
  byAu.get(au).push(o);
}

function getBigInt64(view, offset) {
  return view.getBigInt64(offset, true);
}

const sysAu = (objId, idx) => (BigInt(idx) << 48n) | (BigInt(objId) << 16n);
const u16 = (d) => {
  if (!d) return null;
  let s = "";
  for (let i = 0; i < d.length; i += 2) s += String.fromCharCode(d[i] | (d[i + 1] << 8));
  return s;
};

// 1. Objects
const objects = new Map();
for (const p of byAu.get(sysAu(34, 1)) || []) {
  const slotCnt = view.getUint16(p + 22, true);
  for (let s = 0; s < slotCnt; s++) {
    const off = view.getUint16(p + PAGE - 2 - 2 * s, true);
    if (off < 96 || off >= PAGE) continue;
    const r = p + off;
    const id = view.getInt32(r + 4, true);
    const type = String.fromCharCode(buf[r + 17], buf[r + 18]).trim();
    const fixedEnd = view.getUint16(r + 2, true);
    const ncol = view.getUint16(r + fixedEnd, true);
    const nb = Math.ceil(ncol / 8);
    const nullStart = r + fixedEnd + 2;
    const varCount = view.getUint16(nullStart + nb, true);
    if (varCount > 0) {
      const varStart = nullStart + nb + 2 + 2 * varCount;
      const end0 = view.getUint16(nullStart + nb + 2, true) & 0x7fff;
      const name = u16(buf.subarray(varStart, r + end0));
      objects.set(id, { id, type, name });
    }
  }
}

// 2. Rowsets
const rowsets = new Map();
for (const p of byAu.get(sysAu(5, 0)) || []) {
  const slotCnt = view.getUint16(p + 22, true);
  for (let s = 0; s < slotCnt; s++) {
    const off = view.getUint16(p + PAGE - 2 - 2 * s, true);
    if (off < 96 || off >= PAGE) continue;
    const r = p + off;
    const rsid = getBigInt64(view, r + 4);
    const obj = view.getInt32(r + 13, true);
    const idx = view.getInt32(r + 17, true);
    rowsets.set(rsid, { obj, idx });
  }
}

// 3. AllocUnits
const allocUnits = [];
for (const p of byAu.get(sysAu(7, 0)) || []) {
  const slotCnt = view.getUint16(p + 22, true);
  for (let s = 0; s < slotCnt; s++) {
    const off = view.getUint16(p + PAGE - 2 - 2 * s, true);
    if (off < 96 || off >= PAGE) continue;
    const r = p + off;
    allocUnits.push({
      auid: getBigInt64(view, r + 4),
      type: buf[r + 12],
      owner: getBigInt64(view, r + 13),
    });
  }
}

// 4. colpars
const colpars = new Map();
for (const p of byAu.get(sysAu(41, 1)) || []) {
  const slotCnt = view.getUint16(p + 22, true);
  for (let s = 0; s < slotCnt; s++) {
    const off = view.getUint16(p + PAGE - 2 - 2 * s, true);
    if (off < 96 || off >= PAGE) continue;
    const r = p + off;
    const id = view.getInt32(r + 4, true);
    if (view.getInt16(r + 8, true) !== 0) continue;
    const colid = view.getInt32(r + 10, true);
    const xtype = buf[r + 14];
    const length = view.getInt16(r + 19, true);
    const prec = buf[r + 21];
    const scale = buf[r + 22];
    const fixedEnd = view.getUint16(r + 2, true);
    const ncol = view.getUint16(r + fixedEnd, true);
    const nb = Math.ceil(ncol / 8);
    const nullStart = r + fixedEnd + 2;
    const varCount = view.getUint16(nullStart + nb, true);
    let name = null;
    if (varCount > 0) {
      const varStart = nullStart + nb + 2 + 2 * varCount;
      const end0 = view.getUint16(nullStart + nb + 2, true) & 0x7fff;
      name = u16(buf.subarray(varStart, r + end0));
    }
    if (!colpars.has(id)) colpars.set(id, []);
    colpars.get(id).push({ colid, xtype, length, prec, scale, name });
  }
}

// 5. rscols
const rscols = new Map();
for (const p of byAu.get(sysAu(3, 0)) || []) {
  const slotCnt = view.getUint16(p + 22, true);
  for (let s = 0; s < slotCnt; s++) {
    const off = view.getUint16(p + PAGE - 2 - 2 * s, true);
    if (off < 96 || off >= PAGE) continue;
    const r = p + off;
    const rsid = getBigInt64(view, r + 4);
    const rscolid = view.getInt32(r + 12, true);
    const hbcolid = view.getInt32(r + 16, true);
    const offset = view.getInt16(r + 44, true);
    const bitpos = view.getInt16(r + 48, true);
    if (!rscols.has(rsid)) rscols.set(rsid, []);
    rscols.get(rsid).push({ rscolid, hbcolid, offset, bitpos });
  }
}

function getTableDef(tableName) {
  const obj = Array.from(objects.values()).find((o) => o.name?.toLowerCase() === tableName.toLowerCase() && o.type === "U");
  if (!obj) return null;
  let au = null;
  let owner = null;
  for (const a of allocUnits) {
    if (a.type !== 1) continue;
    const rs = rowsets.get(a.owner);
    if (rs && rs.obj === obj.id && rs.idx <= 1) {
      au = a;
      owner = a.owner;
      break;
    }
  }
  if (!au) return null;
  const names = new Map((colpars.get(obj.id) || []).map((c) => [c.colid, c]));
  const cols = (rscols.get(owner) || [])
    .map((c) => {
      const p = names.get(c.hbcolid);
      return {
        ...c,
        name: p?.name || `col_${c.hbcolid}`,
        xtype: p?.xtype,
        length: p?.length,
        prec: p?.prec,
        scale: p?.scale,
      };
    })
    .filter((c) => c.name);
  return { obj, au, cols };
}

function extractRows(tableName) {
  const def = getTableDef(tableName);
  if (!def) return [];
  const pages = byAu.get(def.au.auid) || [];
  const rows = [];
  for (const p of pages) {
    const slotCnt = view.getUint16(p + 22, true);
    for (let s = 0; s < slotCnt; s++) {
      const off = view.getUint16(p + PAGE - 2 - 2 * s, true);
      if (off < 96 || off >= PAGE) continue;
      const r = p + off;
      const a = buf[r];
      if (((a >> 1) & 7) > 1) continue;
      const fixedEnd = view.getUint16(r + 2, true);
      if (fixedEnd > PAGE) continue;
      const ncol = view.getUint16(r + fixedEnd, true);
      const nb = Math.ceil(ncol / 8);
      const nullStart = r + fixedEnd + 2;
      let varCount = 0;
      let varOffs = [];
      let varStart = 0;
      if (a & 0x20) {
        varCount = view.getUint16(nullStart + nb, true);
        for (let i = 0; i < varCount; i++) {
          varOffs.push(view.getUint16(nullStart + nb + 2 + 2 * i, true));
        }
        varStart = nullStart + nb + 2 + 2 * varCount;
      }
      const isNull = (bitpos) => {
        if (!bitpos || bitpos < 1) return false;
        const colIdx = bitpos - 1;
        const byte = buf[nullStart + Math.floor(colIdx / 8)];
        return (byte & (1 << (colIdx % 8))) !== 0;
      };

      const row = {};
      for (const c of def.cols) {
        if (c.bitpos && isNull(c.bitpos)) {
          row[c.name] = null;
          continue;
        }
        if (c.offset > 0) {
          const pos = r + c.offset;
          if (c.xtype === 56) row[c.name] = view.getInt32(pos, true);
          else if (c.xtype === 52) row[c.name] = view.getInt16(pos, true);
          else if (c.xtype === 48) row[c.name] = buf[pos];
          else if (c.xtype === 104) row[c.name] = (buf[pos] & (1 << (c.bitpos % 8))) !== 0;
          else if (c.xtype === 62) row[c.name] = view.getFloat64(pos, true);
          else if (c.xtype === 59) row[c.name] = view.getFloat32(pos, true);
          else if (c.xtype === 60 || c.xtype === 122) {
            const high = view.getInt32(pos + 4, true);
            const low = view.getUint32(pos, true);
            row[c.name] = Number((BigInt(high) << 32n) | BigInt(low)) / 10000;
          } else if (c.xtype === 175) {
            let str = "";
            for (let i = 0; i < c.length; i++) if (buf[pos + i]) str += String.fromCharCode(buf[pos + i]);
            row[c.name] = str.trim();
          } else if (c.xtype === 61 || c.xtype === 58) {
            const ticks = view.getUint32(pos, true);
            const days = view.getInt32(pos + 4, true);
            const d = new Date(Date.UTC(1900, 0, 1) + days * 86400000 + Math.round(ticks / 300) * 1000);
            row[c.name] = isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
          } else if (c.xtype === 108) {
            const sign = buf[pos];
            let intVal = 0n;
            const dataLen = Math.min(8, (c.length || 9) - 1);
            for (let i = 0; i < dataLen; i++) {
              intVal |= BigInt(buf[pos + 1 + i]) << BigInt(8 * i);
            }
            const s = c.scale || 2;
            row[c.name] = (sign === 0 ? -1 : 1) * Number(intVal) / Math.pow(10, s);
          }
        } else if (c.offset < 0) {
          const varIdx = (-c.offset) - 1;
          if (varIdx >= varCount) {
            row[c.name] = null;
            continue;
          }
          const s = varIdx === 0 ? varStart : r + (varOffs[varIdx - 1] & 0x7fff);
          const e = r + (varOffs[varIdx] & 0x7fff);
          if (s >= e || e > r + PAGE) {
            row[c.name] = null;
            continue;
          }
          const b = buf.subarray(s, e);
          if (c.xtype === 231 || c.xtype === 239) {
            let str = "";
            for (let i = 0; i < b.length; i += 2) str += String.fromCharCode(b[i] | (b[i + 1] << 8));
            row[c.name] = str.trim();
          } else {
            let str = "";
            for (let i = 0; i < b.length; i++) str += String.fromCharCode(b[i]);
            row[c.name] = str.trim();
          }
        }
      }
      rows.push(row);
    }
  }
  return rows;
}

console.log("Extracting and ingesting small & medium tables...");

// 1. tPremise
const premiseRows = extractRows("tPremise");
console.log(`tPremise: extracted ${premiseRows.length} rows`);
if (premiseRows.length > 0) {
  const payload = premiseRows.map((r) => ({ id: String(r.ID), premiseType: r.PremiseType }));
  await supabase.from("TPremise").upsert(payload, { onConflict: "id" });
  console.log("✓ tPremise inserted into TPremise");
}

// 2. tOccupants
const occupantRows = extractRows("tOccupants");
console.log(`tOccupants: extracted ${occupantRows.length} rows`);
if (occupantRows.length > 0) {
  const payload = occupantRows.map((r) => ({ id: String(r.ID), occupants: r.NameofOccupant || r.PropertyNo || "Occupant" }));
  await supabase.from("TOccupants").upsert(payload, { onConflict: "id" });
  console.log("✓ tOccupants inserted into TOccupants");
}

// 3. BillSettings
const billSettingRows = extractRows("BillSettings");
console.log(`BillSettings: extracted ${billSettingRows.length} rows`);
if (billSettingRows.length > 0) {
  const payload = billSettingRows.map((r, i) => ({
    id: `bs-${i + 1}`,
    coordinatorsNumber: r.CordinatorsNumber,
    pmtDate: r.PmtDate ? new Date(r.PmtDate).toISOString() : null,
    ratePADecimalPlaces: r.RatePADecimalPlaces || 5,
    autogenerateCode: Boolean(r.AutogenerateCode),
    collectorLocation: r.CollectorLocation,
    gcatId: r.GCATID,
  }));
  await supabase.from("BillSetting").upsert(payload, { onConflict: "id" });
  console.log("✓ BillSettings inserted into BillSetting");
}

// 4. OWNER$
const ownerDollarRows = extractRows("OWNER$");
console.log(`OWNER$: extracted ${ownerDollarRows.length} rows`);
if (ownerDollarRows.length > 0) {
  await supabase.from("OWNER$").delete().neq("name", "___delete_all___");
  // Chunk insert
  for (let i = 0; i < ownerDollarRows.length; i += 200) {
    const chunk = ownerDollarRows.slice(i, i + 200).map((r) => ({
      id: r.ID || null,
      name: r.Name || null,
      address: r.Address || null,
      tel: r.Tel || null,
      email: r.Email || null,
      mobileNumber: r.MobileNumber || null,
      corporationPartnership: r.CorporationPartnership || null,
      streetAddress: r.StreetAddress || null,
    }));
    await supabase.from("OWNER$").insert(chunk);
  }
  console.log("✓ OWNER$ inserted");
}

// 5. Division_11_P
const divRows = extractRows("Division_11_P");
console.log(`Division_11_P: extracted ${divRows.length} rows`);
if (divRows.length > 0) {
  await supabase.from("Division_11_P").delete().neq("valuation_", "___delete_all___");
  for (let i = 0; i < divRows.length; i += 500) {
    const chunk = divRows.slice(i, i + 500).map((r) => ({
      valuation_: r.valuation_,
      DigitalAdd: r.DigitalAdd,
      DisplayNam: r.DisplayNam,
      HouseNo: r.HouseNo,
      Longitude: r.Longitude,
      Latitude: r.Latitude,
      St_Name: r.St_Name,
      stcode: r.stcode,
    }));
    await supabase.from("Division_11_P").insert(chunk);
  }
  console.log("✓ Division_11_P inserted");
}

// 6. AdjustArrears
const adjRows = extractRows("AdjustArrears");
console.log(`AdjustArrears: extracted ${adjRows.length} rows`);
if (adjRows.length > 0) {
  for (let i = 0; i < adjRows.length; i += 300) {
    const chunk = adjRows.slice(i, i + 300).map((r) => ({
      id: String(r.ID),
      accountNo: r.AccountNo,
      billYear: r.BillYear,
      amount: r.Amount || 0,
      date: r.Date ? new Date(r.Date).toISOString() : new Date().toISOString(),
      adjustedBy: r.AdjustedBy || "ADMIN",
      gcatId: r.GCatID || null,
    }));
    await supabase.from("AdjustArrear").upsert(chunk, { onConflict: "id" });
  }
  console.log("✓ AdjustArrears inserted into AdjustArrear");
}

console.log("\nFinished initial batch ingestion successfully!");
