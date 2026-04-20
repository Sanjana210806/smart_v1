# Pilot Scope Notes

## Implemented now (security + ownership)

- Car number is tied to user ownership via `user_cars`.
- User booking is blocked when the car is not linked to their account.
- A car with an active session (`pending` or `parked`) cannot be booked again in any area.
- Session endpoints (`start`, `fee`, `exit`, `get by id`) enforce ownership for normal users.
- `/my-car` is restricted to the requesting user's linked cars unless role is admin.

## Deferred for later scale-up

- QR hardening and signed/validated gate scans
- Payment processor integration and settlement states
- Area CRUD and advanced multi-tenant admin controls
- Operations hardening (rate limits, audit logs, HA strategy)
- Advanced auth/account features (reset, MFA, revocation)
- Advanced validation and business rules

