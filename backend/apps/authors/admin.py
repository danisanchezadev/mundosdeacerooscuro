from django.contrib import admin

from .models import Author


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "birth_date")
    search_fields = ("name",)
