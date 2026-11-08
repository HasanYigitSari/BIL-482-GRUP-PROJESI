from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler


class AuthError(APIException):
    status_code = 400

    def __init__(self, code, message, status_code=400):
        self.status_code = status_code
        super().__init__({"code": code, "message": message})


def first_message(value):
    if isinstance(value, dict):
        return first_message(next(iter(value.values()))) if value else "The request could not be completed."
    if isinstance(value, list):
        return first_message(value[0]) if value else "The request could not be completed."
    return str(value)


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is not None and not (
        isinstance(response.data, dict) and "code" in response.data and "message" in response.data
    ):
        response.data = {
            "code": getattr(exc, "default_code", "invalid_request"),
            "message": first_message(response.data),
        }
    return response
