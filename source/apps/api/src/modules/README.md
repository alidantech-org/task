# Hosted API modules

The API is intended to begin as a modular monolith. Each directory documents a logical module boundary; these are not separate services or deployment units. Cross-module operations must use explicit contracts. Authorization is enforced server-side for protected operations.
