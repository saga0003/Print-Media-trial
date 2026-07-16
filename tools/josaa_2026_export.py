from __future__ import annotations

import csv
import hashlib
import io
import os
import textwrap
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Sequence

import requests
from pypdf import PdfReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# These files are verbatim text captures of JoSAA's 2026 OR-CR table.
SOURCES = {
    1: "https://raw.githubusercontent.com/quadius/josaa-tracker/558f4972e601ecec0c0d9c188eead7a5bdfcfbbc/data/josaaRoundData/r1.txt",
    2: "https://raw.githubusercontent.com/quadius/josaa-tracker/558f4972e601ecec0c0d9c188eead7a5bdfcfbbc/data/josaaRoundData/r2.txt",
    3: "https://raw.githubusercontent.com/quadius/josaa-tracker/558f4972e601ecec0c0d9c188eead7a5bdfcfbbc/data/josaaRoundData/r3.txt",
    4: "https://raw.githubusercontent.com/quadius/josaa-tracker/e653d32f974bd6f4dc14bc695e24f8ad21363a36/data/josaaRoundData/r4.txt",
}
OFFICIAL_URL = "https://josaa.admissions.nic.in/applicant/seatallotmentresult/currentorcr.aspx"
HEADERS = [
    "Institute",
    "Academic Program Name",
    "Quota",
    "Seat Type",
    "Gender",
    "Opening Rank",
    "Closing Rank",
]


def clean_text(value: str) -> str:
    replacements = {
        "\u2013": "-",
        "\u2014": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u00a0": " ",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    return value.encode("latin-1", "replace").decode("latin-1")


def fetch_round(round_no: int) -> tuple[str, list[list[str]], str]:
    url = SOURCES[round_no]
    response = requests.get(url, timeout=90)
    response.raise_for_status()
    raw = response.content
    digest = hashlib.sha256(raw).hexdigest()
    text = raw.decode("utf-8-sig", errors="replace")

    if "Joint Seat Allocation Authority 2026" not in text:
        raise ValueError(f"Round {round_no}: expected JoSAA 2026 title was not found")
    if "\t".join(HEADERS) not in text:
        raise ValueError(f"Round {round_no}: expected seven-column header was not found")

    rows: list[list[str]] = []
    malformed = 0
    for raw_line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw_line.strip("\n")
        if not line.strip():
            continue
        parts = [clean_text(p.strip()) for p in line.split("\t")]
        if parts == HEADERS:
            continue
        if len(parts) == 7:
            # Ignore metadata/footer rows; actual records have a non-empty quota and ranks.
            if parts[0] and parts[2] and parts[5] and parts[6]:
                rows.append(parts)
        elif "\t" in line:
            malformed += 1

    if not 12000 <= len(rows) <= 15000:
        raise ValueError(
            f"Round {round_no}: suspicious record count {len(rows)}; expected roughly 12k-15k"
        )
    if malformed:
        print(f"Round {round_no}: ignored {malformed} malformed tabbed lines")

    return text, rows, digest


def split_long_token(token: str, font_name: str, font_size: float, width: float) -> list[str]:
    if stringWidth(token, font_name, font_size) <= width:
        return [token]
    chunks: list[str] = []
    current = ""
    for char in token:
        trial = current + char
        if current and stringWidth(trial, font_name, font_size) > width:
            chunks.append(current)
            current = char
        else:
            current = trial
    if current:
        chunks.append(current)
    return chunks


def wrap_cell(text: str, font_name: str, font_size: float, width: float) -> list[str]:
    usable = max(8.0, width - 6.0)
    words: list[str] = []
    for token in text.split():
        words.extend(split_long_token(token, font_name, font_size, usable))
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if stringWidth(trial, font_name, font_size) <= usable:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_page_frame(
    pdf: canvas.Canvas,
    round_no: int,
    record_count: int,
    page_no: int,
    page_width: float,
    page_height: float,
    margin: float,
    col_widths: Sequence[float],
) -> float:
    pdf.setFillColor(colors.HexColor("#131E35"))
    pdf.rect(0, page_height - 42, page_width, 42, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(margin, page_height - 25, f"JoSAA 2026 Opening & Closing Ranks - Round {round_no}")
    pdf.setFont("Helvetica", 7.5)
    pdf.drawRightString(
        page_width - margin,
        page_height - 24,
        f"{record_count:,} records | A3 landscape searchable PDF",
    )

    pdf.setFillColor(colors.HexColor("#26364F"))
    pdf.setFont("Helvetica", 6.7)
    note = (
        "OPEN ranks use CRL; EWS/OBC-NCL/SC/ST use category ranks; PwD uses the applicable "
        "PwD category rank. A 'P' suffix denotes a preparatory rank-list entry."
    )
    pdf.drawString(margin, page_height - 53, note)

    table_top = page_height - 62
    header_height = 15
    x = margin
    pdf.setFillColor(colors.HexColor("#E8ECF2"))
    pdf.rect(margin, table_top - header_height, sum(col_widths), header_height, stroke=0, fill=1)
    pdf.setStrokeColor(colors.HexColor("#98A2B3"))
    pdf.setLineWidth(0.35)
    pdf.rect(margin, table_top - header_height, sum(col_widths), header_height, stroke=1, fill=0)
    pdf.setFillColor(colors.HexColor("#131E35"))
    pdf.setFont("Helvetica-Bold", 7.1)
    for header, width in zip(HEADERS, col_widths):
        pdf.drawString(x + 3, table_top - 10.5, header)
        x += width
        pdf.line(x, table_top, x, table_top - header_height)

    pdf.setFillColor(colors.HexColor("#475467"))
    pdf.setFont("Helvetica", 6.3)
    pdf.drawString(margin, 10, f"Source table: {OFFICIAL_URL}")
    pdf.drawRightString(page_width - margin, 10, f"Round {round_no} | Page {page_no}")
    return table_top - header_height


def create_pdf(round_no: int, rows: Sequence[Sequence[str]], output_path: Path) -> int:
    page_width, page_height = landscape(A3)
    margin = 20.0
    col_widths = [250.0, 430.0, 42.0, 115.0, 170.0, 70.0, 70.0]
    assert sum(col_widths) <= page_width - (2 * margin)

    body_font = "Helvetica"
    body_size = 6.3
    leading = 7.2
    minimum_row_height = 10.5
    bottom_limit = 22.0

    pdf = canvas.Canvas(
        str(output_path),
        pagesize=(page_width, page_height),
        pageCompression=1,
        invariant=False,
    )
    pdf.setTitle(f"JoSAA 2026 Round {round_no} Opening and Closing Ranks")
    pdf.setAuthor("Generated from JoSAA 2026 published OR-CR data")
    pdf.setSubject("Opening and Closing Ranks for JoSAA counselling 2026")
    pdf.setKeywords("JoSAA, 2026, cutoff, opening rank, closing rank, IIT, NIT, IIIT, GFTI")

    page_no = 1
    y = draw_page_frame(pdf, round_no, len(rows), page_no, page_width, page_height, margin, col_widths)
    alternate = False

    for row in rows:
        wrapped = [wrap_cell(str(value), body_font, body_size, width) for value, width in zip(row, col_widths)]
        line_count = max(len(lines) for lines in wrapped)
        row_height = max(minimum_row_height, line_count * leading + 3.2)

        if y - row_height < bottom_limit:
            pdf.showPage()
            page_no += 1
            y = draw_page_frame(pdf, round_no, len(rows), page_no, page_width, page_height, margin, col_widths)
            alternate = False

        if alternate:
            pdf.setFillColor(colors.HexColor("#F7F9FC"))
            pdf.rect(margin, y - row_height, sum(col_widths), row_height, stroke=0, fill=1)
        alternate = not alternate

        pdf.setStrokeColor(colors.HexColor("#D0D5DD"))
        pdf.setLineWidth(0.25)
        pdf.rect(margin, y - row_height, sum(col_widths), row_height, stroke=1, fill=0)

        x = margin
        pdf.setFillColor(colors.black)
        pdf.setFont(body_font, body_size)
        for col_index, (lines, width) in enumerate(zip(wrapped, col_widths)):
            if col_index >= 5:
                # Right-align ranks.
                for line_index, text in enumerate(lines):
                    pdf.drawRightString(x + width - 3, y - 8.0 - (line_index * leading), text)
            else:
                for line_index, text in enumerate(lines):
                    pdf.drawString(x + 3, y - 8.0 - (line_index * leading), text)
            x += width
            pdf.line(x, y, x, y - row_height)
        y -= row_height

    pdf.save()
    return page_no


def validate_pdf(path: Path, minimum_pages: int = 100) -> int:
    reader = PdfReader(str(path))
    page_count = len(reader.pages)
    if page_count < minimum_pages:
        raise ValueError(f"{path.name}: unexpectedly short PDF ({page_count} pages)")
    first_text = reader.pages[0].extract_text() or ""
    if "JoSAA 2026 Opening & Closing Ranks" not in first_text:
        raise ValueError(f"{path.name}: title text could not be extracted")
    return page_count


def main() -> None:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    manifests: list[dict[str, str | int]] = []
    pdf_paths: list[Path] = []

    for round_no in range(1, 5):
        print(f"Fetching Round {round_no}...")
        _, rows, digest = fetch_round(round_no)
        pdf_path = OUTPUT_DIR / f"JoSAA_2026_Round_{round_no}_OR_CR.pdf"
        print(f"Creating {pdf_path.name} from {len(rows):,} records...")
        page_count = create_pdf(round_no, rows, pdf_path)
        verified_pages = validate_pdf(pdf_path)
        if page_count != verified_pages:
            raise ValueError(f"Round {round_no}: generated/verified page count mismatch")
        pdf_digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
        manifests.append(
            {
                "round": round_no,
                "records": len(rows),
                "pages": page_count,
                "source_url": SOURCES[round_no],
                "source_sha256": digest,
                "pdf_sha256": pdf_digest,
                "pdf_file": pdf_path.name,
            }
        )
        pdf_paths.append(pdf_path)
        print(f"Round {round_no}: {len(rows):,} records, {page_count} pages")

    manifest_path = OUTPUT_DIR / "manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(manifests[0].keys()))
        writer.writeheader()
        writer.writerows(manifests)

    readme_path = OUTPUT_DIR / "README.txt"
    record_summary = "\n".join(
        f"Round {m['round']}: {m['records']:,} records, {m['pages']} PDF pages, file {m['pdf_file']}"
        for m in manifests
    )
    readme_path.write_text(
        textwrap.dedent(
            f"""
            JoSAA 2026 Opening and Closing Ranks - Rounds 1 to 4
            Generated: {generated_at}

            CONTENTS
            {record_summary}
            manifest.csv: record counts, source URLs and SHA-256 checksums

            DATA SOURCE
            Official JoSAA OR-CR portal:
            {OFFICIAL_URL}

            The official portal publishes the records in an interactive web table rather than
            as four standalone downloadable PDFs. These PDFs were generated from verbatim 2026
            text captures of that table stored in the public quadius/josaa-tracker repository.
            Exact source URLs and hashes are recorded in manifest.csv.

            IMPORTANT RANK NOTE
            OPEN-seat ranks represent CRL. EWS, OBC-NCL, SC and ST-seat ranks represent their
            respective category ranks. PwD ranks are within the applicable category. A suffix
            'P' denotes the Preparatory Rank List.

            DISCLAIMER
            These are convenient, unofficial PDF exports of published cutoff records. For any
            admission decision, verify the relevant entry on the official JoSAA portal.
            """
        ).strip()
        + "\n",
        encoding="utf-8",
    )

    zip_path = OUTPUT_DIR / "JoSAA_2026_Rounds_1_to_4_OR_CR_PDFs.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in [*pdf_paths, readme_path, manifest_path]:
            zf.write(path, arcname=path.name)

    zip_digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    print(f"Created {zip_path} ({zip_path.stat().st_size:,} bytes)")
    print(f"ZIP SHA-256: {zip_digest}")


if __name__ == "__main__":
    main()
