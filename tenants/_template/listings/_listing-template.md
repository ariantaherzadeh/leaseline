---
# Copy to tenants/<tenant>/listings/<id>.md. The filename must equal `id`.
# Only write facts you've verified. Unknown → TBD (the assistant will offer a follow-up, never guess).
id: street-number-unit # lowercase-with-dashes
title: 123 Example St, Unit 4
address:
  street: 123 Example St
  unit: "4" # or null
  city: Ottawa
  province: "ON" # quoted: YAML reads bare ON as true
  postal_code: K1A 0A1
neighbourhood: Example Neighbourhood
property_type: Apartment # e.g. Duplex (ground floor), Condo apartment
rent_monthly: 2000 # CAD, integer
beds: 1
baths: 1
sqft: TBD # integer, a range like "600–699", or TBD
available: TBD # YYYY-MM-DD, immediately, or TBD
pets: TBD # e.g. "Pet friendly", "Allowed with restrictions", "No pets", or TBD
utilities_included: [] # e.g. [heat, water]
tenant_pays: [] # e.g. [hydro, internet]
laundry: TBD # e.g. In-unit
parking: TBD # or { spots: 1, type: underground }
cooling: TBD # e.g. Central air conditioning, None
heating: TBD # e.g. Forced air (natural gas)
outdoor: null # e.g. Balcony
storage: null # e.g. Storage locker
amenities: [] # building amenities
transit: null # e.g. 5-minute walk to X station
highlights: [] # short selling points
source:
  mls_number: null
  url: null
---

## About this home
Two or three sentences a person would say out loud: what it is, where it is, what stands out.

## Good fit for
Describe needs, not people: "someone with two cars", "anyone who wants outdoor space".
Never describe who should live there by age, family status, or any other protected ground.

## Good to know
Honest trade-offs and details renters ask about (e.g. no A/C, hydro extra).
