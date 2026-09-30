"""Schemas for tenants and listings.

A tenant is one LeaseLine customer (a realtor or property manager). Its listings are Markdown
files with YAML front matter: the front matter is structured data for validation and the site,
and the body is prose the agent reads.

Any fact that isn't confirmed is written as the literal string ``TBD``. The agent treats TBD as
"not confirmed, offer a follow-up" and never guesses.
"""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

TBD = "TBD"
Tbd = Literal["TBD"]

Slug = Annotated[str, Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=64)]
SqftRange = Annotated[str, Field(pattern=r"^\d{3,5}\s*[\u2013-]\s*\d{3,5}$")]  # e.g. "600-699"
HexColor = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Address(_Strict):
    street: str
    unit: str | None = None
    city: str
    province: str
    postal_code: str


class Parking(_Strict):
    spots: int = Field(ge=0)
    type: str | None = None  # e.g. "driveway", "underground"


class Source(_Strict):
    mls_number: str | None = None
    url: HttpUrl | None = None


class Listing(_Strict):
    id: Slug
    title: str
    address: Address
    neighbourhood: str
    property_type: str
    rent_monthly: int = Field(gt=0)
    beds: int = Field(ge=0)
    baths: float = Field(gt=0)
    sqft: int | SqftRange | Tbd
    available: date | Literal["immediately"] | Tbd
    pets: str | Tbd
    utilities_included: list[str] = []
    tenant_pays: list[str] = []
    laundry: str | Tbd
    parking: Parking | Tbd
    cooling: str | Tbd
    heating: str | Tbd
    outdoor: str | None = None
    storage: str | None = None
    amenities: list[str] = []
    transit: str | None = None
    highlights: list[str] = []
    source: Source | None = None
    body: str = Field(min_length=1, description="Markdown prose after the front matter.")

    def tbd_fields(self) -> list[str]:
        """Names of fields that are still unconfirmed."""
        return [name for name, value in self if value == TBD]


class Team(_Strict):
    name: str = Field(description='How Steve refers to the humans, e.g. "the leasing team".')
    city: str


class Persona(_Strict):
    name: str = "Steve"
    voice_id: str


class Brand(_Strict):
    accent: HexColor
    co_brand: str | None = Field(
        default=None, description='Optional text line, e.g. "for Jane Doe, REALTOR®". No logos.'
    )


class Tenant(_Strict):
    slug: Slug
    agent_id: str | None = None
    team: Team
    persona: Persona
    brand: Brand
    domains: list[str] = Field(min_length=1)
    follow_up: str

    @field_validator("domains")
    @classmethod
    def _bare_hostnames(cls, domains: list[str]) -> list[str]:
        for d in domains:
            if "://" in d or "/" in d:
                raise ValueError(f"domain must be a bare hostname, got {d!r}")
        return domains
