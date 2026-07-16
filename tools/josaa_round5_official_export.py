from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import textwrap
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

URL = "https://josaa.admissions.nic.in/applicant/seatallotmentresult/currentorcr.aspx"
OUT = Path("output_round5")
OUT.mkdir(exist_ok=True)


def hidden_fields(soup: BeautifulSoup) -> dict[str, str]:
    data = {}
    for tag in soup.select("input[type=hidden][name]"):
        data[tag.get("name")] = tag.get("value", "")
    return data


def selects_summary(soup: BeautifulSoup) -> list[dict]:
    result = []
    for select in soup.find_all("select"):
        result.append({
            "id": select.get("id"),
            "name": select.get("name"),
            "options": [
                {"value": opt.get("value", ""), "text": opt.get_text(" ", strip=True)}
                for opt in select.find_all("option")
            ],
        })
    return result


def postback(session: requests.Session, response: requests.Response, field: str, value: str) -> requests.Response:
    soup = BeautifulSoup(response.content, "lxml")
    data = hidden_fields(soup)
    data[field] = value
    # ASP.NET AutoPostBack dropdowns commonly require EVENTTARGET.
    data["__EVENTTARGET"] = field.replace("$", ":")
    data["__EVENTARGUMENT"] = ""
    headers = {"Referer": URL, "User-Agent": "Mozilla/5.0"}
    r = session.post(URL, data=data, headers=headers, timeout=90)
    r.raise_for_status()
    return r


def submit_form(session: requests.Session, response: requests.Response, selections: dict[str, str], button: tuple[str, str]) -> requests.Response:
    soup = BeautifulSoup(response.content, "lxml")
    data = hidden_fields(soup)
    data.update(selections)
    data[button[0]] = button[1]
    data["__EVENTTARGET"] = ""
    data["__EVENTARGUMENT"] = ""
    headers = {"Referer": URL, "User-Agent": "Mozilla/5.0"}
    r = session.post(URL, data=data, headers=headers, timeout=180)
    r.raise_for_status()
    return r


def find_value(select: BeautifulSoup, desired_text: str, fallback: str | None = None) -> str:
    for opt in select.find_all("option"):
        if opt.get_text(" ", strip=True).casefold() == desired_text.casefold():
            return opt.get("value", "")
    if fallback is not None:
        for opt in select.find_all("option"):
            if opt.get("value") == fallback:
                return fallback
    raise KeyError(f"Option {desired_text!r} not found in {select.get('name')}")


def main() -> None:
    with requests.Session() as session:
        session.headers.update({"User-Agent": "Mozilla/5.0"})
        r = session.get(URL, timeout=90)
        r.raise_for_status()
        print("GET", r.status_code, len(r.content))
        soup = BeautifulSoup(r.content, "lxml")
        print(json.dumps(selects_summary(soup), indent=2)[:20000])

        selects = soup.find_all("select")
        by_name = {s.get("name"): s for s in selects if s.get("name")}
        round_name = next(name for name in by_name if "round" in name.lower())
        round_value = find_value(by_name[round_name], "5", "5")
        print("Selecting round", round_name, round_value)
        r = postback(session, r, round_name, round_value)

        # Select ALL for each cascading dropdown in page order.
        soup = BeautifulSoup(r.content, "lxml")
        selections: dict[str, str] = {round_name: round_value}
        for select in soup.find_all("select"):
            name = select.get("name")
            if not name or name == round_name:
                continue
            options = select.find_all("option")
            if not options:
                continue
            all_opt = None
            for opt in options:
                text = opt.get_text(" ", strip=True).casefold()
                val = opt.get("value", "")
                if text in {"all", "--all--", "all institutes", "all institute types", "all academic programs", "all seat types / categories"} or val.upper() == "ALL":
                    all_opt = opt
                    break
            if all_opt is None:
                # Empty/select option is not useful; choose the first non-placeholder option only for diagnostics.
                print("No ALL option yet for", name, [(o.get('value'), o.get_text(' ', strip=True)) for o in options[:10]])
                continue
            value = all_opt.get("value", "ALL")
            print("Selecting", name, value, all_opt.get_text(" ", strip=True))
            r = postback(session, r, name, value)
            selections[name] = value
            soup = BeautifulSoup(r.content, "lxml")

        # Rebuild exact final selections from live page and locate submit button.
        soup = BeautifulSoup(r.content, "lxml")
        final_selects = {s.get("name"): s for s in soup.find_all("select") if s.get("name")}
        final_values = {round_name: round_value}
        for name, select in final_selects.items():
            if name == round_name:
                continue
            all_value = None
            for opt in select.find_all("option"):
                if opt.get("value", "").upper() == "ALL" or opt.get_text(" ", strip=True).casefold() in {"all", "--all--"}:
                    all_value = opt.get("value", "")
                    break
            if all_value is not None:
                final_values[name] = all_value

        buttons = []
        for inp in soup.select("input[type=submit][name]"):
            buttons.append((inp.get("name"), inp.get("value", ""), inp.get("id")))
        print("Buttons", buttons)
        button = next((name, value) for name, value, _ in buttons if "submit" in (name + value).lower())
        r = submit_form(session, r, final_values, button)
        print("SUBMIT", r.status_code, len(r.content))
        (OUT / "round5_response.html").write_bytes(r.content)

        soup = BeautifulSoup(r.content, "lxml")
        table = soup.find("table", id=re.compile("GridView", re.I))
        if table is None:
            tables = soup.find_all("table")
            print("No GridView table. table count", len(tables))
            for idx, tbl in enumerate(tables[:20]):
                print("TABLE", idx, tbl.get("id"), tbl.get_text(" ", strip=True)[:300])
            raise RuntimeError("Round 5 result table not found")

        dfs = pd.read_html(str(table))
        if not dfs:
            raise RuntimeError("No dataframe parsed")
        df = dfs[0].dropna(how="all")
        print("Columns", list(df.columns))
        print("Rows", len(df))
        print(df.head(3).to_string())
        if not 12000 <= len(df) <= 15000:
            raise RuntimeError(f"Suspicious Round 5 row count: {len(df)}")
        expected = ["Institute", "Academic Program Name", "Quota", "Seat Type", "Gender", "Opening Rank", "Closing Rank"]
        if list(df.columns) != expected:
            raise RuntimeError(f"Unexpected columns: {list(df.columns)}")
        df.to_csv(OUT / "JoSAA_2026_Round_5_OR_CR.csv", index=False)
        print("CSV SHA256", hashlib.sha256((OUT / "JoSAA_2026_Round_5_OR_CR.csv").read_bytes()).hexdigest())


if __name__ == "__main__":
    main()
