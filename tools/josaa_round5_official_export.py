from __future__ import annotations

import csv
import hashlib
import json
import zipfile
from pathlib import Path

import requests

from josaa_2026_export import HEADERS, clean_text, create_pdf, validate_pdf

SOURCE_URL = "https://raw.githubusercontent.com/quadius/josaa-tracker/6715d8c474641acea9ef492809c1e4f4a94e90eb/data/josaaRoundData/r5.txt"
OFFICIAL_URL = "https://josaa.admissions.nic.in/applicant/seatallotmentresult/currentorcr.aspx"
OUT = Path("output_round5")
OUT.mkdir(parents=True, exist_ok=True)


def fetch_rows() -> tuple[list[list[str]], str]:
    response = requests.get(SOURCE_URL, timeout=120)
    response.raise_for_status()
    raw = response.content
    text = raw.decode("utf-8-sig", errors="replace")

    if "Joint Seat Allocation Authority 2026" not in text:
        raise RuntimeError("JoSAA 2026 title not found")
    if "\t".join(HEADERS) not in text:
        raise RuntimeError("Expected seven-column header not found")

    rows: list[list[str]] = []
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if "\t" not in line:
            continue
        parts = [clean_text(value.strip()) for value in line.split("\t")]
        if parts == HEADERS:
            continue
        if len(parts) == 7 and parts[0] and parts[2] and parts[5] and parts[6]:
            rows.append(parts)

    if not 12000 <= len(rows) <= 15000:
        raise RuntimeError(f"Suspicious Round 5 record count: {len(rows)}")
    return rows, hashlib.sha256(raw).hexdigest()


def main() -> None:
    rows, source_sha = fetch_rows()

    csv_path = OUT / "JoSAA_2026_Round_5_OR_CR.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(HEADERS)
        writer.writerows(rows)

    pdf_path = OUT / "JoSAA_2026_Round_5_OR_CR.pdf"
    generated_pages = create_pdf(5, rows, pdf_path)
    verified_pages = validate_pdf(pdf_path)
    if generated_pages != verified_pages:
        raise RuntimeError("PDF page-count validation mismatch")

    manifest = {
        "round": 5,
        "records": len(rows),
        "pages": verified_pages,
        "official_portal": OFFICIAL_URL,
        "source_capture": SOURCE_URL,
        "source_sha256": source_sha,
        "csv_sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
        "pdf_sha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
    }
    manifest_path = OUT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    zip_path = OUT / "JoSAA_2026_Round_5_OR_CR.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        archive.write(pdf_path, pdf_path.name)
        archive.write(csv_path, csv_path.name)
        archive.write(manifest_path, manifest_path.name)

    print(json.dumps(manifest, indent=2))
    print(f"ZIP: {zip_path} ({zip_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
