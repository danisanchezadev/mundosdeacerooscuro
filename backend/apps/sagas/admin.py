from django.contrib import admin

from .models import Saga


@admin.register(Saga)
class SagaAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
