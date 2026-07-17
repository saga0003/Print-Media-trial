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


def selected_values(soup: BeautifulSoup) -> dict[str, str]:
    values = {}
    for sel in soup.find_all("select"):
        name = sel.get("name")
        if not name:
            continue
        chosen