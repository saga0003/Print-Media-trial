from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

from josaa_2026_export import HEADERS, create_pdf, validate_pdf

URL = "https://josaa.admissions.nic.in/applicant/seatallotmentresult/currentorcr.aspx"
OUT = Path("output_round5")
OUT.mkdir(exist_ok=True)


def hidden(soup):
    return {x.get("name"): x.get("value", "") for x in soup.select("input[type=hidden][name]")}


def current_selects(soup):
    result = {}
    for s in soup.find_all("select"):
        name = s.get("name")
        if not name:
            continue
        opt = s.find("option", selected=True)
        if opt is None and s.find("option") is not None:
            opt = s.find("option")
        if opt is not None:
            result[name] = opt.get("value", "")
    return result


def choose_value(select, wanted_text=None, wanted_value=None):
    for o in select.find_all("option"):
        text = o.get_text(" ", strip=True).casefold()
        value = o.get("value", "")
        if wanted_text is not None and text == wanted_text.casefold():
            return value
        if wanted_value is not None and value == wanted_value:
            return value
    raise RuntimeError(f"Option not found in {select.get('name')}: text={wanted_text} value={wanted_value}")


def postback(session, response, field, value):
    soup = BeautifulSoup(response.content, "lxml")
    data = hidden(soup)
    data.update(current_selects(soup))
    data[field] = value
    data["__EVENTTARGET"] = field
    data["__EVENTARGUMENT"] = ""
    r = session.post(URL, data=data, headers={"Referer": URL}, timeout=180)
    r.raise_for_status()
    return r


def summarize(stage, response):
    soup = BeautifulSoup(response.content, "lxml")
    info = {"stage": stage, "status": response.status_code, "length": len(response.content), "selects": []}
    for s in soup.find_all("select"):
        info["selects"].append({
            "name": s.get("name"),
            "options": [{"value": o.get("value", ""), "text": o.get_text(" ", strip=True), "selected": o.has_attr("selected")} for o in s.find_all("option")]
        })
    return info


def find_result_dataframe(html):
    for df in pd.read_html(html):
        df = df.dropna(how="all")
        cols = [str(x).strip() for x in df.columns]
        if len(cols) == 7 and cols == HEADERS:
            df.columns = HEADERS
            return df
    return None


def main():
    stages = []
    with requests.Session() as s:
        s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36"})
        r = s.get(URL, timeout=90)
        r.raise_for_status()
        stages.append(summarize("initial", r))

        fields = [
            ("ctl00$ContentPlaceHolder1$ddlroundno", "5", None),
            ("ctl00$ContentPlaceHolder1$ddlInstype", None, "All"),
            ("ctl00$ContentPlaceHolder1$ddlInstitute", None, "All"),
            ("ctl00$ContentPlaceHolder1$ddlBranch", None, "All"),
            ("ctl00$ContentPlaceHolder1$ddlSeattype", None, "All"),
        ]
        for field, wanted_value, wanted_text in fields:
            soup = BeautifulSoup(r.content, "lxml")
            sel = soup.find("select", attrs={"name": field})
            if sel is None:
                raise RuntimeError(f"Missing select {field}")
            try:
                value = choose_value(sel, wanted_text=wanted_text, wanted_value=wanted_value)
            except RuntimeError:
                # Some pages label the aggregate option as ALL or All Institute Types.
                options = sel.find_all("option")
                candidate = next((o for o in options if o.get("value", "").upper() == "ALL" or o.get_text(" ", strip=True).casefold().startswith("all")), None)
                if candidate is None:
                    raise
                value = candidate.get("value", "")
            r = postback(s, r, field, value)
            stages.append(summarize(field, r))

        soup = BeautifulSoup(r.content, "lxml")
        data = hidden(soup)
        data.update(current_selects(soup))
        data["ctl00$ContentPlaceHolder1$btnSubmit"] = "Submit"
        data["__EVENTTARGET"] = ""
        data["__EVENTARGUMENT"] = ""
        r = s.post(URL, data=data, headers={"Referer": URL}, timeout=240)
        r.raise_for_status()
        stages.append(summarize("submit", r))
        (OUT / "round5_result_response.html").write_bytes(r.content)

    (OUT / "stage_summary.json").write_text(json.dumps(stages, indent=2), encoding="utf-8")
    df = find_result_dataframe(r.text)
    if df is None:
        raise RuntimeError("Official Round 5 result table was not found; diagnostics saved")
    df = df.dropna(how="all")
    if not 12000 <= len(df) <= 15000:
        raise RuntimeError(f"Suspicious Round 5 row count: {len(df)}")
    df.to_csv(OUT / "JoSAA_2026_Round_5_OR_CR.csv", index=False)
    rows = [[str(v) for v in row] for row in df.itertuples(index=False, name=None)]
    pdf_path = OUT / "JoSAA_2026_Round_5_OR_CR.pdf"
    pages = create_pdf(5, rows, pdf_path)
    verified = validate_pdf(pdf_path)
    if pages != verified:
        raise RuntimeError("PDF page-count validation failed")
    manifest = {
        "round": 5,
        "records": len(rows),
        "pages": pages,
        "source": URL,
        "csv_sha256": hashlib.sha256((OUT / "JoSAA_2026_Round_5_OR_CR.csv").read_bytes()).hexdigest(),
        "pdf_sha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
