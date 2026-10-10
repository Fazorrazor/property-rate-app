export interface ParsedBakRow {
  accountNumber: string;
  name?: string;
  arrears?: number;
  currentBill?: number;
  amountPaid?: number;
  outstanding?: number;
}

const PAGE = 8192;
const BASE = 512;

function getBigInt64(view: DataView, offset: number, littleEndian = true) {
  return view.getBigInt64(offset, littleEndian);
}

function cdInt(b: Uint8Array) {
  if (!b.length) return 0;
  let v = b[0] ^ 0x80;
  if (v & 0x80) v -= 256;
  for (let i = 1; i < b.length; i++) v = v * 256 + b[i];
  return v;
}

function varDecimal(b: Uint8Array) {
  if (!b.length) return 0;
  const neg = (b[0] & 0x80) === 0;
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) {
    bytes[i] = neg ? ~b[i] & 0xff : b[i];
  }
  const e = (bytes[0] & 0x7f) - 64;
  let bits = "";
  for (let i = 1; i < bytes.length; i++) {
    bits += bytes[i].toString(2).padStart(8, "0");
  }
  let digits = "";
  for (let i = 0; i + 10 <= bits.length; i += 10) {
    digits += String(parseInt(bits.slice(i, i + 10), 2)).padStart(3, "0");
  }
  const v = Number("0." + digits) * Math.pow(10, e + 1);
  return Math.round((neg ? -v : v) * 1e6) / 1e6;
}

export function parseBakBuffer(buffer: ArrayBuffer): ParsedBakRow[] {
  const buf = new Uint8Array(buffer);
  const view = new DataView(buffer);

  const pagesById = new Map<string, number>();
  const byAu = new Map<bigint, number[]>();

  for (let o = BASE; o + PAGE <= buf.length; o += PAGE) {
    if (buf[o] !== 1) continue;
    const fileId = view.getUint16(o + 36, true);
    const pageId = view.getUint32(o + 32, true);
    const id = `${fileId}:${pageId}`;
    pagesById.set(id, o);

    if (buf[o + 1] !== 1) continue;
    const high = BigInt(view.getUint16(o + 6, true));
    const low = BigInt(view.getUint32(o + 24, true));
    const au = (high << BigInt(48)) | (low << BigInt(16));
    if (!byAu.has(au)) byAu.set(au, []);
    byAu.get(au)!.push(o);
  }

  function getRecords(o: number) {
    const slotCnt = view.getUint16(o + 22, true);
    const recs = [];
    for (let s = 0; s < slotCnt; s++) {
      const off = view.getUint16(o + PAGE - 2 - 2 * s, true);
      if (off < 96 || off >= PAGE) continue;
      const r = o + off;
      const a = buf[r];
      const type = (a >> 1) & 7;
      if (type !== 0 && type !== 1) continue; // primary/forwarded only
      const fixedEnd = view.getUint16(r + 2, true);
      const ncol = view.getUint16(r + fixedEnd, true);
      const nb = Math.ceil(ncol / 8);
      const nullStart = r + fixedEnd + 2;
      let varCount = 0;
      let varOffs: number[] = [];
      let varStart = 0;
      if (a & 0x20) {
        varCount = view.getUint16(nullStart + nb, true);
        for (let i = 0; i < varCount; i++) {
          varOffs.push(view.getUint16(nullStart + nb + 2 + 2 * i, true));
        }
        varStart = nullStart + nb + 2 + 2 * varCount - r;
      }

      recs.push({
        r,
        ncol,
        varCol: (i: number) => {
          if (i >= varCount) return null;
          const start = i === 0 ? varStart : varOffs[i - 1] & 0x7fff;
          const end = varOffs[i] & 0x7fff;
          return buf.subarray(r + start, r + end);
        },
      });
    }
    return recs;
  }

  const allRecords = (au: bigint) => (byAu.get(au) || []).flatMap((o) => getRecords(o));
  const sysAu = (objId: number, idx: number) => (BigInt(idx) << BigInt(48)) | (BigInt(objId) << BigInt(16));
  const u16 = (d: Uint8Array | null) => {
    if (!d) return null;
    let s = "";
    for (let i = 0; i < d.length; i += 2) {
      s += String.fromCharCode(d[i] | (d[i + 1] << 8));
    }
    return s;
  };

  const objects = new Map<number, { id: number; type: string; name: string | null }>();
  for (const rec of allRecords(sysAu(34, 1))) {
    const id = view.getInt32(rec.r + 4, true);
    let type = "";
    for (let i = rec.r + 17; i <= rec.r + 18; i++) type += String.fromCharCode(buf[i]);
    type = type.trim();
    objects.set(id, { id, type, name: u16(rec.varCol(0)) });
  }

  const rowsets = new Map<bigint, { obj: number; idx: number }>();
  for (const rec of allRecords(sysAu(5, 0))) {
    rowsets.set(getBigInt64(view, rec.r + 4, true), {
      obj: view.getInt32(rec.r + 13, true),
      idx: view.getInt32(rec.r + 17, true),
    });
  }

  const allocUnits: { auid: bigint; type: number; owner: bigint }[] = [];
  for (const rec of allRecords(sysAu(7, 0))) {
    allocUnits.push({
      auid: getBigInt64(view, rec.r + 4, true),
      type: buf[rec.r + 12],
      owner: getBigInt64(view, rec.r + 13, true),
    });
  }

  const colpars = new Map<number, any[]>();
  for (const rec of allRecords(sysAu(41, 1))) {
    const id = view.getInt32(rec.r + 4, true);
    if (view.getInt16(rec.r + 8, true) !== 0) continue;
    const c = {
      colid: view.getInt32(rec.r + 10, true),
      xtype: buf[rec.r + 14],
      name: u16(rec.varCol(0)),
    };
    if (!colpars.has(id)) colpars.set(id, []);
    colpars.get(id)!.push(c);
  }

  const rscols = new Map<bigint, any[]>();
  for (const rec of allRecords(sysAu(3, 0))) {
    const rsid = getBigInt64(view, rec.r + 4, true);
    const c = {
      rscolid: view.getInt32(rec.r + 12, true),
      hbcolid: view.getInt32(rec.r + 16, true),
      offset: view.getInt32(rec.r + 44, true),
    };
    if (!rscols.has(rsid)) rscols.set(rsid, []);
    rscols.get(rsid)!.push(c);
  }

  let billTable: any = null;
  for (const au of allocUnits) {
    if (au.type !== 1) continue;
    const rs = rowsets.get(au.owner);
    if (!rs) continue;
    const obj = objects.get(rs.obj);
    if (!obj || obj.type !== "U" || rs.idx > 1) continue;
    if (obj.name === "Bill") {
      const names = new Map((colpars.get(rs.obj) || []).map((c) => [c.colid, c]));
      const cols = (rscols.get(au.owner) || [])
        .sort((a, b) => a.rscolid - b.rscolid)
        .map((c) => ({
          ...c,
          name: names.get(c.hbcolid)?.name,
        }));
      billTable = { auid: au.auid, objId: rs.obj, idx: rs.idx, cols };
      break;
    }
  }

  if (!billTable) throw new Error("Could not locate 'Bill' table inside .bak file.");

  function cdRecord(r: number): (Uint8Array | null)[] | null {
    const h = buf[r];
    if (((h >> 1) & 7) !== 0) return null;
    let p = r + 1;
    let n = buf[p++];
    if (n & 0x80) n = ((n & 0x7f) << 8) | buf[p++];
    if (n > 30) throw new Error("cluster arrays not supported");
    const nib = [];
    for (let i = 0; i < n; i++) {
      nib.push(i & 1 ? buf[p + (i >> 1)] >> 4 : buf[p + (i >> 1)] & 0xf);
    }
    p += Math.ceil(n / 2);
    const cols: (Uint8Array | null)[] = [];
    const longIdx = [];
    for (let i = 0; i < n; i++) {
      const k = nib[i];
      if (k === 0) cols.push(null);
      else if (k === 1) cols.push(new Uint8Array(0));
      else if (k >= 2 && k <= 9) {
        cols.push(buf.subarray(p, p + k - 1));
        p += k - 1;
      } else if (k === 10) {
        cols.push(null); // Placeholder
        longIdx.push(i);
      } else {
        throw new Error("unsupported CD nibble " + k);
      }
    }
    if (longIdx.length) {
      p++;
      const cnt = view.getUint16(p, true);
      p += 2;
      const offs = Array.from({ length: cnt }, (_, i) => view.getUint16(p + 2 * i, true));
      p += 2 * cnt;
      let prev = 0;
      longIdx.forEach((ci, j) => {
        const end = offs[j] & 0x7fff;
        cols[ci] = buf.subarray(p + prev, p + end);
        prev = end;
      });
    }
    return cols;
  }

  const ix = (n: string) => billTable.cols.findIndex((c: any) => c.name === n);
  const bills: any[] = [];

  const pages = byAu.get(billTable.auid) || [];
  for (const o of pages) {
    const slotCnt = view.getUint16(o + 22, true);
    for (let s = 0; s < slotCnt; s++) {
      const off = view.getUint16(o + PAGE - 2 - 2 * s, true);
      if (off < 96 || off >= PAGE) continue;
      const c = cdRecord(o + off);
      if (!c) continue;
      
      const accBuf = c[ix("AccountNO")];
      if (!accBuf) continue;
      let acc = "";
      for (let i = 0; i < accBuf.length; i++) acc += String.fromCharCode(accBuf[i]);
      acc = acc.trim();
      if (!acc) continue;

      const dec = (n: string) => {
        const v = c[ix(n)];
        return v === null ? 0 : varDecimal(v);
      };
      
      const yearBuf = c[ix("BillYear")];
      const year = yearBuf ? cdInt(yearBuf) : null;

      bills.push({
        acc,
        year,
        balanceBF: dec("BalanceBF"),
        ratePA: dec("RatePA"),
        accountBalance: dec("AccountBalance"),
        totalPaid: dec("TotalPaid"),
      });
    }
  }

  // Aggregate by account.
  // The RMMS UI typically calculates "Arrears" and "Current Bill" from the *latest* year's bill record,
  // or it aggregates them. Usually the latest year record holds the true outstanding balance.
  const map = new Map<string, ParsedBakRow>();

  // Sort bills by year ascending so the latest overwrites/updates
  bills.sort((a, b) => (a.year || 0) - (b.year || 0));

  for (const b of bills) {
    // For outstanding, RMMS computes Arrears + Current - Paid
    // The accountBalance field in Bill often matches the expected balance.
    map.set(b.acc, {
      accountNumber: b.acc,
      arrears: b.balanceBF,
      currentBill: b.ratePA,
      amountPaid: b.totalPaid,
      outstanding: b.accountBalance,
    });
  }

  return Array.from(map.values());
}
