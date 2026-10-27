from django.contrib import admin

from .models import Review, ReviewComment


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("title", "book", "user", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = ("title", "content", "book__title", "user__email")
    raw_id_fields = ("book", "user")


@admin.register(ReviewComment)
class ReviewCommentAdmin(admin.ModelAdmin):
    list_display = ("review", "user", "created_at")
    search_fields = ("content", "user__email")
    raw_id_fields = ("review", "user")
