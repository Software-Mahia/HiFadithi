from ocr.parsers import parse_fields


def test_parses_labelled_card():
    text = """
    NATIONAL MUSEUMS OF KENYA
    Accession No: NMK/ETH/2024/017
    Object: Giriama clay pot
    Material: Fired clay
    Dimensions: 32 cm high, 28 cm wide
    Date: Early 20th century
    Provenance: Kilifi County
    Donor: J. Mwangi
    Location: Store 3, Shelf B
    """
    fields = parse_fields(text)
    assert fields["accession_number"] == "NMK/ETH/2024/017"
    assert fields["name"] == "Giriama clay pot"
    assert fields["material"] == "Fired clay"
    assert fields["dimensions"] == "32 cm high, 28 cm wide"
    assert fields["date_or_period"] == "Early 20th century"
    assert fields["provenance"] == "Kilifi County"
    assert fields["donor"] == "J. Mwangi"
    assert fields["location"] == "Store 3, Shelf B"


def test_handles_label_on_its_own_line():
    text = "Accession No\nNMK/2024/1\nObject\nBead necklace\n"
    fields = parse_fields(text)
    assert fields["accession_number"] == "NMK/2024/1"
    assert fields["name"] == "Bead necklace"


def test_unmatched_text_goes_to_description():
    text = "Accession No: NMK/1\nA handwritten note about the item\nSecond line"
    fields = parse_fields(text)
    assert "handwritten note" in fields["description"]
    assert "Second line" in fields["description"]


def test_bare_accession_number():
    fields = parse_fields("NMK/ETH/2023/099\nClay bowl")
    assert fields["accession_number"] == "NMK/ETH/2023/099"
