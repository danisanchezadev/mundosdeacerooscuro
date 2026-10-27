from django.contrib import admin

from .models import Award


@admin.register(Award)
class AwardAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
