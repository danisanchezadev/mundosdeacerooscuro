from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

from apps.common.sanitizers import sanitize_text


class AccountAdapter(DefaultAccountAdapter):
    def save_user(self, request, user, form, commit=True):
        user = super().save_user(request, user, form, commit=False)
        data = getattr(form, "cleaned_data", {}) or {}
        user.name = sanitize_text(data.get("name", ""))[:150]
        user.email = user.email.lower()
        if commit:
            user.save()
        return user


class SocialAccountAdapter(DefaultSocialAccountAdapter):
    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        extra = sociallogin.account.extra_data or {}
        full_name = data.get("name") or " ".join(filter(None, [data.get("first_name"), data.get("last_name")]))
        user.name = sanitize_text(full_name or extra.get("name", ""))[:150]
        user.avatar_url = (extra.get("picture") or "")[:500]
        return user
