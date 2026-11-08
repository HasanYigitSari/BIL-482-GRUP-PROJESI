"""Provider boundary. The mock is local and repeatable; no HTTP requests are made."""
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID
import time
from urllib.parse import urlsplit


class TemporaryProviderError(Exception):
    pass


class PermanentProviderError(Exception):
    pass


@dataclass(frozen=True)
class ProviderItem:
    reference: str
    url: str


class Provider(Protocol):
    def acquire(self, product_reference: str, request_id: UUID, *, fail: bool = False) -> ProviderItem: ...


class MockProvider:
    def acquire(self, product_reference, request_id, *, fail=False):
        time.sleep(2)
        if product_reference != "demo-link":
            raise PermanentProviderError()
        if fail:
            raise TemporaryProviderError()
        return ProviderItem(reference=f"mock-{request_id}", url=f"https://example.invalid/items/{request_id}")


PROVIDERS: dict[str, Provider] = {"mock": MockProvider()}


def acquire(provider_key, product_reference, request_id, *, fail=False):
    provider = PROVIDERS.get(provider_key)
    if provider is None:
        raise PermanentProviderError()
    result = provider.acquire(product_reference, request_id, fail=fail)
    if not isinstance(result, ProviderItem) or not isinstance(result.reference, str) or not isinstance(result.url, str):
        raise PermanentProviderError()
    try:
        parsed = urlsplit(result.url)
        valid = parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password
    except ValueError:
        valid = False
    if not valid or not result.reference.strip() or len(result.reference) > 200 or len(result.url) > 2000:
        raise PermanentProviderError()
    return result
