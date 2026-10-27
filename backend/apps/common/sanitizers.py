"""Input sanitisation helpers.

All user-provided free text is stored as plain text: HTML tags are removed and
control characters dropped. The frontend renders it through React, which escapes
output, so stored content can never be interpreted as markup.
"""
import re

from django.utils.html import strip_tags
from rest_framework import serializers

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SCRIPT_BLOCK = re.compile(r"<(script|style)\b[^>]*>.*?</\1\s*>", re.IGNORECASE | re.DOTALL)
_DANGLING_TAG = re.compile(r"<(?=[a-zA-Z/!?])")


def sanitize_text(value: str | None) -> str:
    if not value:
        return ""
    text = _CONTROL_CHARS.sub("", str(value))
    text = _SCRIPT_BLOCK.sub("", text)
    previous = None
    while previous != text:  # strip_tags may need several passes on nested payloads
        previous = text
        text = strip_tags(text)
    # An unterminated "<tag" survives strip_tags; drop its opening bracket so no markup remains.
    return _DANGLING_TAG.sub("", text).strip()


class SanitizedCharField(serializers.CharField):
    def to_internal_value(self, data):
        cleaned = sanitize_text(super().to_internal_value(data))
        if not cleaned and not self.allow_blank:
            self.fail("blank")
        return cleaned
