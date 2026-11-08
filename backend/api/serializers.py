from rest_framework import serializers

from .models import User, username_validator


class SignupSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=30, trim_whitespace=True)

    def validate_username(self, value):
        value = value.lower()
        username_validator(value)
        return value


class CompleteSerializer(serializers.Serializer):
    ceremony_id = serializers.UUIDField()
    credential = serializers.DictField(allow_empty=False)


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]
