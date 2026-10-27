from django.contrib import admin

from .models import Loan, Reservation, UserBook


@admin.register(UserBook)
class UserBookAdmin(admin.ModelAdmin):
    list_display = ("book", "owner", "available_for_loan", "created_at")
    list_filter = ("available_for_loan",)
    raw_id_fields = ("book", "owner")


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("id", "user_book", "owner", "borrower", "status", "requested_at")
    list_filter = ("status",)
    raw_id_fields = ("owner", "borrower", "user_book")


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ("book", "user", "queue_position", "active", "created_at")
    list_filter = ("active",)
    raw_id_fields = ("book", "user")
