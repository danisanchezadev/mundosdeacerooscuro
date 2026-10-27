class RefreshAfterWriteMixin:
    """Re-read the instance through `get_queryset()` after a write so that
    annotated fields (counts, averages...) are present in the response."""

    def _refresh(self, serializer):
        serializer.instance = self.get_queryset().get(pk=serializer.instance.pk)

    def perform_create(self, serializer):
        serializer.save()
        self._refresh(serializer)

    def perform_update(self, serializer):
        serializer.save()
        self._refresh(serializer)
