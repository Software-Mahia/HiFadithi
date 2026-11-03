import pytest
from django.db import IntegrityError, transaction

from artefacts.models import VIEW_KEYS, Artefact, Capture

pytestmark = pytest.mark.django_db


def make_artefact(**kw):
    return Artefact.objects.create(nmk_accession_no=kw.pop("no", "NMK-1"), title="Emedot", **kw)


def test_new_artefact_is_draft():
    assert make_artefact().collection_status == "draft"


def test_accession_number_is_unique():
    make_artefact()
    with pytest.raises(IntegrityError), transaction.atomic():
        make_artefact()


def test_height_must_be_positive():
    with pytest.raises(IntegrityError), transaction.atomic():
        make_artefact(height_mm=0)


def test_capture_cannot_be_complete_without_four_views():
    artefact = make_artefact()
    with pytest.raises(IntegrityError), transaction.atomic():
        Capture.objects.create(artefact=artefact, upload_complete=True, views={"front": "x"})


def test_capture_complete_with_four_views_is_allowed():
    artefact = make_artefact()
    views = {key: f"captures/{key}.jpg" for key in VIEW_KEYS}
    capture = Capture.objects.create(artefact=artefact, upload_complete=True, views=views)
    assert capture.upload_complete