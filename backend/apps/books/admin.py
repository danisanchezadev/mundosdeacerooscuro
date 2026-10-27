from django.contrib import admin

from .models import Book


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "saga", "publication_year", "language", "isbn")
    list_filter = ("language", "saga", "awards")
    search_fields = ("title", "isbn", "author__name")
    autocomplete_fields = ("author", "saga")
    filter_horizontal = ("awards",)
