"""Turn Tesseract text into the artefact form fields."""

import re

FIELD_ALIASES = {
    "accession_number": (
        "accession no",
        "accession number",
        "accession",
        "acc no",
        "acc. no",
        "reg no",
        "registration number",
        "catalogue no",
        "catalog no",
        "object no",
        "inventory no",
    ),
    "name": (
        "object name",
        "object",
        "title",
        "name of object",
        "item",
        "artefact",
        "artifact",
    ),
    "material": ("material", "materials", "medium", "media"),
    "dimensions": ("dimensions", "dimension", "measurements", "measurement", "size"),
    "date_or_period": ("date/period", "date", "period", "date of collection", "age"),
    "provenance": ("provenance", "source", "origin", "place of origin", "collection"),
    "donor": ("donor", "donated by", "donor name", "collector"),
    "location": ("location", "store", "storage", "shelf", "room", "display"),
}

FIELD_ORDER = list(FIELD_ALIASES.keys())
SEPARATOR = re.compile(r"\s*[:=\-\u2013\u2014]\s*")


def _normalise(line):
    return re.sub(r"\s+", " ", line.strip().strip("|[]")).strip()


def _match_label(line):
    lowered = line.lower().strip(" .")
    for field, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if lowered == alias:
                return field, ""
            if lowered.startswith(alias):
                remainder = lowered[len(alias) :]
                if not remainder or remainder[0] in " :=\t-":
                    value = line[len(alias) :].strip()
                    value = SEPARATOR.sub("", value, count=1).strip()
                    return field, value
    return None, ""


def parse_fields(text):
    fields = {field: "" for field in FIELD_ORDER}
    unmatched = []
    lines = [line for line in (text or "").splitlines() if line.strip()]

    index = 0
    while index < len(lines):
        line = _normalise(lines[index])
        field, value = _match_label(line)
        if field is None:
            unmatched.append(line)
            index += 1
            continue
        if not value and index + 1 < len(lines):
            next_line = _normalise(lines[index + 1])
            next_field, _ = _match_label(next_line)
            if next_field is None:
                value = next_line
                index += 1
        if value and not fields[field]:
            fields[field] = value[:500]
        index += 1

    # A bare accession number is common on museum cards.
    if not fields["accession_number"]:
        match = re.search(r"\b(?:NMK|ACC|INV)[\s./-]*[A-Z0-9][A-Z0-9./-]{2,}\b", text or "")
        if match:
            fields["accession_number"] = match.group(0).strip()

    fields["description"] = "\n".join(unmatched).strip()[:2000]
    return fields
