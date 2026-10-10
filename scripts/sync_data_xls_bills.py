import os
import sys
import time
import json
import urllib.request
import urllib.error
import xlrd

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://jzezuitkenrfkzrkphiz.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

EXCEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "docs", "DB", "arnold-20261006T081539Z-1-001", "arnold", "data.xls"
)

def post_batch(endpoint, items, on_conflict=None, resolution="merge-duplicates", max_retries=3):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    data = json.dumps(items).encode("utf-8")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": f"resolution={resolution}",
    }
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=60) as resp:
                if resp.status in (200, 201, 204):
                    return True
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            print(f"\n[HTTP Error {e.code}] on {endpoint}: {err_msg}")
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                raise
        except Exception as e:
            print(f"\n[Network Error] on {endpoint}: {e}")
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                raise

def get_all_prop_accounts():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    accs = set()
    offset = 0
    limit = 1000
    while True:
        url = f"{SUPABASE_URL}/rest/v1/Property?select=account_no&offset={offset}&limit={limit}"
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if not data:
                break
            for row in data:
                if row.get("account_no"):
                    accs.add(row["account_no"].strip())
            if len(data) < limit:
                break
            offset += len(data)
    return accs

def clean_float(val, default=0.0):
    if val is None or val == "":
        return default
    try:
        return float(val)
    except:
        return default

def main():
    t0 = time.time()
    sys.stdout.reconfigure(encoding="utf-8")
    print("=== STARTING OPTION 1 MASTER BILL & PROPERTY CADASTRE SYNC ===")
    print(f"Loading Excel file: {EXCEL_PATH}")
    wb = xlrd.open_workbook(EXCEL_PATH)
    sh = wb.sheet_by_name("Bill")
    headers = [sh.cell_value(0, c) for c in range(sh.ncols)]
    print(f"Excel Bill rows: {sh.nrows - 1}")

    print("\nFetching current Property accounts from Supabase...")
    existing_props = get_all_prop_accounts()
    print(f"✓ Found {len(existing_props)} existing properties in Supabase.")

    # 1. Parse all bills and group by account
    bills_by_acc = {}
    all_bill_records = []

    for r in range(1, sh.nrows):
        row = {headers[c]: sh.cell_value(r, c) for c in range(sh.ncols)}
        raw_acc = str(row.get("AccountNO", "")).strip()
        if not raw_acc:
            continue
        try:
            yr = int(float(row.get("BillYear", 0)))
        except:
            continue

        raw_date = row.get("BillDate")
        iso_date = f"{yr}-01-15T00:00:00.000Z"
        if isinstance(raw_date, float) and raw_date > 0:
            try:
                dt = xlrd.xldate_as_datetime(raw_date, wb.datemode)
                iso_date = dt.isoformat() + "Z"
            except:
                pass

        rate_pa = clean_float(row.get("RatePA"), 0.0)
        balance_bf = clean_float(row.get("BalanceBF"), 0.0)
        rateable_val = clean_float(row.get("RateableValue"), 0.0)
        account_bal = clean_float(row.get("AccountBalance"), 0.0)
        impose_rate = clean_float(row.get("ImposeRate"), 0.00055)
        prev_yr_bill = clean_float(row.get("PrevYearBill"), 0.0)
        total_paid = clean_float(row.get("TotalPaid"), 0.0)
        gcat_id = str(row.get("GCatID", "")).strip() or None
        prepared_by = str(row.get("PreparedBy", "")).strip() or "RMMS_KPONE2020"

        bill_item = {
            "id": f"bill_{raw_acc}_{yr}",
            "accountNo": raw_acc,
            "billYear": yr,
            "ratePA": round(rate_pa, 2),
            "balanceBF": round(balance_bf, 2),
            "rateableValue": round(rateable_val, 2),
            "accountBalance": round(account_bal, 2),
            "billDate": iso_date,
            "gcatId": gcat_id,
            "preparedBy": prepared_by,
            "printed": True,
            # Extra fields for new property shell derivation
            "_imposeRate": impose_rate,
            "_prevYrBill": prev_yr_bill,
            "_totalPaid": total_paid,
        }

        all_bill_records.append(bill_item)
        if raw_acc not in bills_by_acc:
            bills_by_acc[raw_acc] = []
        bills_by_acc[raw_acc].append(bill_item)

    print(f"✓ Parsed {len(all_bill_records)} valid bill records across {len(bills_by_acc)} unique accounts.")

    # 2. Insert ONLY missing properties
    missing_accs = [acc for acc in bills_by_acc if acc not in existing_props]
    print(f"\nMissing properties to create in Property table: {len(missing_accs)}")

    if missing_accs:
        prop_payloads = []
        for acc in missing_accs:
            acc_bills = bills_by_acc[acc]
            latest_bill = max(acc_bills, key=lambda b: b["billYear"])
            cat = "COMMERCIAL" if latest_bill.get("gcatId") == "C" else "PRIVATE THIRD CLASS RESIDENTIAL"
            current_bill = latest_bill["ratePA"]
            arrears = latest_bill["balanceBF"]
            bill_amount = round(arrears + current_bill, 2)
            amount_paid = latest_bill.get("_totalPaid", 0.0)
            outstanding = latest_bill["accountBalance"]
            if outstanding == 0.0 and bill_amount > 0:
                outstanding = max(0.0, round(bill_amount - amount_paid, 2))

            prop_item = {
                "id": f"prop_{acc}",
                "account_no": acc,
                "ownerDigitalAddress": f"GK-KKMA-{acc}",
                "municipality": "Kpone-Katamanso (KKMA)",
                "property_cat": cat,
                "billYear": latest_bill["billYear"],
                "billDate": latest_bill["billDate"],
                "rateableValue": latest_bill["rateableValue"],
                "rateImposed": latest_bill.get("_imposeRate") or 0.00055,
                "previousYearBill": latest_bill.get("_prevYrBill", 0.0),
                "amount_paid": amount_paid,
                "arrears": arrears,
                "current_bill": current_bill,
                "bill_amount": bill_amount,
                "name": None,
                "telephone": None,
                "outstanding_amt": outstanding,
                "initial_arrears": arrears,
                "current_arrears": arrears,
                "total_paid_cycle": amount_paid,
                "cumulative_arrears": arrears,
            }
            prop_payloads.append(prop_item)

        print(f"Inserting {len(prop_payloads)} brand-new property shells...")
        chunk_size = 200
        for i in range(0, len(prop_payloads), chunk_size):
            chunk = prop_payloads[i : i + chunk_size]
            post_batch("Property", chunk, on_conflict="account_no", resolution="ignore-duplicates")
            pct = ((min(i + chunk_size, len(prop_payloads))) / len(prop_payloads)) * 100
            print(f"  Inserted properties: {min(i + chunk_size, len(prop_payloads))}/{len(prop_payloads)} ({pct:.1f}%)", end="\r")
        print(f"\n✓ Completed creating {len(prop_payloads)} missing property shells in Property table.")
    else:
        print("✓ All properties already exist in Property table. Zero shells needed.")

    # 3. Upsert all 65,535 bills into Bill table
    print(f"\nUpserting all {len(all_bill_records)} authentic bills into Bill table...")
    clean_bills = []
    for b in all_bill_records:
        clean_bills.append({
            "id": b["id"],
            "accountNo": b["accountNo"],
            "billYear": b["billYear"],
            "ratePA": b["ratePA"],
            "balanceBF": b["balanceBF"],
            "rateableValue": b["rateableValue"],
            "accountBalance": b["accountBalance"],
            "billDate": b["billDate"],
            "gcatId": b["gcatId"],
            "preparedBy": b["preparedBy"],
            "printed": b["printed"],
        })

    bill_chunk_size = 500
    for i in range(0, len(clean_bills), bill_chunk_size):
        chunk = clean_bills[i : i + bill_chunk_size]
        post_batch("Bill", chunk, on_conflict="id", resolution="merge-duplicates")
        pct = ((min(i + bill_chunk_size, len(clean_bills))) / len(clean_bills)) * 100
        print(f"  Upserted bills: {min(i + bill_chunk_size, len(clean_bills))}/{len(clean_bills)} ({pct:.1f}%)", end="\r")

    elapsed = time.time() - t0
    print(f"\n✓ All {len(clean_bills)} authentic bills successfully synchronized into Supabase Bill table!")
    print(f"\n=== OPTION 1 FULL SYNCHRONIZATION FINISHED IN {elapsed:.1f} SECONDS! ===")

if __name__ == "__main__":
    main()
