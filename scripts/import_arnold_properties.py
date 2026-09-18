import os
import sys
import time
import zipfile
import re
import json
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

SUPABASE_URL = "https://jzezuitkenrfkzrkphiz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6ZXp1aXRrZW5yZmt6cmtwaGl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyODA4NjEsImV4cCI6MjEwMzg1Njg2MX0.65s4OvVtgkrLpngsF9e6UwkWJIX4G1ydyuu1zzsEQSw"
EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "docs", "DB", "proprties_arnold.xlsx")

def clean_phone(raw_phone):
    if not raw_phone:
        return None
    raw = str(raw_phone).strip()
    digits = re.sub(r"\D", "", raw)
    if not digits or digits == "0":
        return None
    if digits.startswith("233") and len(digits) == 12:
        return "0" + digits[3:]
    if len(digits) == 9 and not digits.startswith("0"):
        return "0" + digits
    if len(digits) == 10 and digits.startswith("0"):
        return digits
    if len(digits) >= 9:
        return digits
    return None

def clean_str(val):
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.upper() == "NULL":
        return None
    return s

def clean_name(val):
    s = clean_str(val)
    if not s or s.upper() == "OWNER":
        return None
    return s

def clean_float(val, default=0.0):
    if val is None:
        return default
    s = str(val).strip().replace(",", "")
    if not s or s.upper() == "NULL":
        return default
    try:
        return float(s)
    except (ValueError, TypeError):
        return default

def post_batch(endpoint, items, resolution="merge-duplicates", max_retries=3):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
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
    return False

def main():
    print(f"=== Starting Municipal Cadastre Import ===")
    print(f"Source file: {EXCEL_PATH}")
    if not os.path.exists(EXCEL_PATH):
        print(f"Error: Excel file not found at {EXCEL_PATH}")
        sys.exit(1)

    t0 = time.time()
    print("Reading shared strings and worksheet from Excel archive...")

    with zipfile.ZipFile(EXCEL_PATH, "r") as z:
        strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            ss_tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in ss_tree.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                t = si.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                if t is not None and t.text:
                    strings.append(t.text)
                else:
                    text_parts = [elem.text for elem in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t") if elem.text]
                    strings.append("".join(text_parts))

        sheet_tree = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        sheet_data = sheet_tree.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData")
        rows = sheet_data.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row")

    total_rows = len(rows) - 1
    print(f"Total property records in Excel: {total_rows}")

    def parse_row(row_elem):
        cells = {}
        for c in row_elem.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
            ref = c.attrib.get("r", "")
            col = re.match(r"([A-Z]+)", ref).group(1)
            t = c.attrib.get("t", "")
            v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
            val = v.text if v is not None else ""
            if t == "s" and val.isdigit():
                val = strings[int(val)]
            cells[col] = val
        return cells

    print("Parsing and validating rows...")
    properties_by_account = {}
    users_to_insert = {}
    links_set = set()

    for r in rows[1:]:
        c = parse_row(r)
        account_no = clean_str(c.get("B"))
        if not account_no:
            continue

        # Skip the 2 protected test accounts if they happen to appear in source
        if account_no in ("KKDA03991001", "KKDA244044647"):
            continue

        name = clean_name(c.get("C"))
        telephone = clean_phone(c.get("D"))
        owner_digital_address = clean_str(c.get("E"))
        house_no = clean_str(c.get("F"))
        plot_no = clean_str(c.get("G"))
        valuation_no = clean_str(c.get("H"))
        property_cat = clean_str(c.get("I")) or "PRIVATE THIRD CLASS RESIDENTIAL"
        municipality = clean_str(c.get("K")) or "Kpone-Katamanso (KKMA)"
        electoral_area = clean_str(c.get("L"))

        rate_imposed = clean_float(c.get("P"), 0.00025)
        if rate_imposed <= 0:
            rate_imposed = 0.00025

        current_bill = clean_float(c.get("R"), 0.0)
        arrears = clean_float(c.get("U"), 0.0)
        bill_amount = clean_float(c.get("S"), arrears + current_bill)
        amount_paid = clean_float(c.get("T"), 0.0)
        previous_year_bill = clean_float(c.get("Q"), 0.0)
        outstanding_amt = clean_float(c.get("V"), bill_amount)

        raw_rv = clean_float(c.get("O"), 0.0)
        if raw_rv > 0:
            rateable_value = raw_rv
        elif current_bill > 0:
            rateable_value = round(current_bill / rate_imposed, 2)
        else:
            rateable_value = 0.0

        prop_id = f"prop_{account_no}"

        prop_record = {
            "id": prop_id,
            "account_no": account_no,
            "ownerDigitalAddress": owner_digital_address or "",
            "houseNo": house_no,
            "plotNo": plot_no,
            "valuationNo": valuation_no,
            "municipality": municipality,
            "property_cat": property_cat,
            "billYear": 2026,
            "billDate": "2026-01-01T00:00:00.000Z",
            "rateableValue": rateable_value,
            "rateImposed": rate_imposed,
            "previousYearBill": previous_year_bill,
            "amount_paid": amount_paid,
            "arrears": arrears,
            "current_bill": current_bill,
            "bill_amount": bill_amount,
            "name": name,
            "telephone": telephone,
            "electoral_area": electoral_area,
            "outstanding_amt": outstanding_amt,
        }
        properties_by_account[account_no] = prop_record

        if telephone:
            user_id = f"usr_{telephone}"
            if telephone not in users_to_insert:
                users_to_insert[telephone] = {
                    "id": user_id,
                    "phoneNumber": telephone,
                    "name": name or "Municipal Ratepayer",
                    "role": "RATEPAYER",
                    "isVerified": False,
                    "createdAt": "2026-01-01T00:00:00.000Z",
                    "updatedAt": "2026-01-01T00:00:00.000Z",
                }
            links_set.add((prop_id, user_id))

    properties_to_insert = list(properties_by_account.values())
    links_to_insert = [{"A": a, "B": b} for a, b in links_set]

    print(f"Validated {len(properties_to_insert)} unique properties.")
    print(f"Found {len(users_to_insert)} unique citizen phone numbers for User creation.")
    print(f"Prepared {len(links_to_insert)} unique _PropertyToUser relationships.")

    # 1. Bulk Insert Users (ignoring duplicates to protect existing users)
    user_list = list(users_to_insert.values())
    if user_list:
        print("\n--- Inserting Citizen Users ---")
        u_chunk_size = 300
        for i in range(0, len(user_list), u_chunk_size):
            chunk = user_list[i : i + u_chunk_size]
            post_batch("User", chunk, resolution="ignore-duplicates")
            print(f"  Inserted users: {min(i + u_chunk_size, len(user_list))}/{len(user_list)}", end="\r")
        print(f"\n  Done: {len(user_list)} users inserted/synced.")

    # 2. Bulk Upsert Properties
    print("\n--- Inserting Properties ---")
    p_chunk_size = 500
    for i in range(0, len(properties_to_insert), p_chunk_size):
        chunk = properties_to_insert[i : i + p_chunk_size]
        post_batch("Property", chunk, resolution="merge-duplicates")
        pct = ((i + len(chunk)) / len(properties_to_insert)) * 100
        print(f"  Inserted properties: {min(i + p_chunk_size, len(properties_to_insert))}/{len(properties_to_insert)} ({pct:.1f}%)", end="\r")
    print(f"\n  Done: {len(properties_to_insert)} properties inserted/synced.")

    # 3. Bulk Insert _PropertyToUser links (ignoring duplicates)
    if links_to_insert:
        print("\n--- Linking Properties to Users ---")
        l_chunk_size = 500
        for i in range(0, len(links_to_insert), l_chunk_size):
            chunk = links_to_insert[i : i + l_chunk_size]
            post_batch("_PropertyToUser", chunk, resolution="ignore-duplicates")
            print(f"  Linked: {min(i + l_chunk_size, len(links_to_insert))}/{len(links_to_insert)}", end="\r")
        print(f"\n  Done: {len(links_to_insert)} property-user links inserted.")

    elapsed = time.time() - t0
    print(f"\n=== Import Completed Successfully in {elapsed:.1f} seconds! ===")

if __name__ == "__main__":
    main()
