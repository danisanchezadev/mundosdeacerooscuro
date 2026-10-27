from django.apps import AppConfig


class SagasConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.sagas"
    label = "sagas"
