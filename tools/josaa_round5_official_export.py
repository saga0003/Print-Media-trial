from pathlib import Path
import json
import requests
from bs4 import BeautifulSoup

URL = "https://josaa.admissions.nic.in/applicant/seatallotmentresult/currentorcr.aspx"
OUT = Path("output_round5")
OUT.mkdir(exist_ok=True)

s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36"})
r = s.get(URL, timeout=90)
r.raise_for_status()
(OUT / "initial.html").write_bytes(r.content)
soup = BeautifulSoup(r.content, "lxml")
summary = {
    "url": r.url,
    "status": r.status_code,
    "length": len(r.content),
    "forms": [],
    "selects": [],
    "submits": [],
}
for form in soup.find_all("form"):
    summary["forms"].append({"id": form.get("id"), "name": form.get("name"), "action": form.get("action"), "method": form.get("method")})
for sel in soup.find_all("select"):
    summary["selects"].append({
        "id": sel.get("id"), "name": sel.get("name"),
        "options": [{"value": o.get("value", ""), "text": o.get_text(" ", strip=True), "selected": o.has_attr("selected")} for o in sel.find_all("option")]
    })
for inp in soup.select("input[type=submit], button"):
    summary["submits"].append({"tag": inp.name, "id": inp.get("id"), "name": inp.get("name"), "value": inp.get("value"), "text": inp.get_text(" ", strip=True)})
(OUT / "form_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
print(json.dumps(summary, indent=2))
