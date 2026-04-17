# Security and Authorization Guide

## Purpose
This guide explains how authentication and authorization currently work in the API and how to extend them safely.

## Current Components

- Security configuration:
  - `src/main/java/unicauca/edu/co/API/Config/Security/SecurityConfig.java`
- JWT filter:
  - `src/main/java/unicauca/edu/co/API/Config/Security/JwtAuthenticationFilter.java`
- Unauthorized response handler (401):
  - `src/main/java/unicauca/edu/co/API/Config/Security/RestAuthenticationEntryPoint.java`
- Auth token validation contract:
  - `src/main/java/unicauca/edu/co/API/Services/Interfaces/IN/IAuthService.java`
- Authorization business contract:
  - `src/main/java/unicauca/edu/co/API/Services/Interfaces/IN/IAuthorizationService.java`
- Authorization business implementation:
  - `src/main/java/unicauca/edu/co/API/Services/IN/AuthorizationService.java`

## Request Flow

1. `SecurityFilterChain` is stateless and has global `permitAll`.
2. `JwtAuthenticationFilter` runs before `UsernamePasswordAuthenticationFilter`.
3. Filter tries to extract bearer token from `Authorization` header.
4. If no token, request continues as anonymous.
5. If token exists:
   - validate using `IAuthService.validateToken(token)`
   - validate claims (`exp`, `iss`, `aud`)
   - resolve/create user via `IUserService.findOrCreateUserFromToken(...)`
   - create `UsernamePasswordAuthenticationToken`
   - store authentication in `SecurityContext`
6. Request reaches controller/service layer.
7. If endpoint has `@PreAuthorize("isAuthenticated()")` and no authentication exists, API returns `401`.

## Token Requirements

A token is considered valid for authentication when all conditions are true:

- Signature and core validation pass in `IAuthService`.
- `exp` claim is greater than current epoch second.
- `iss` claim equals `https://securetoken.google.com/<aud>`.
- At least one user identifier exists: `uid` or `email`.

## Method-level Authorization

### Why global permitAll plus PreAuthorize

The project uses:

- HTTP layer: `anyRequest().permitAll()`
- Business/API protection: `@PreAuthorize` annotations

This design keeps endpoint-level authorization explicit and easy to audit.

### Current protected endpoints

- `POST /api/products/search`
- `POST /api/intent/intent`
- `GET /api/v1/products/{productId}/priceHistory`

### Add protection to a new endpoint

```java
@PreAuthorize("isAuthenticated()")
@GetMapping("/my-protected-endpoint")
public ResponseEntity<?> myHandler() {
    ...
}
```

### Role expressions examples

```java
@PreAuthorize("hasRole('PREMIUM')")
@PreAuthorize("hasAnyRole('REGISTERED','PREMIUM')")
```

Note: Spring role prefix is `ROLE_`; filter creates authorities from domain role names.

## AuthorizationService Usage

`AuthorizationService` is useful when you need explicit checks from business code.

Implemented capabilities:

- `getAuthenticatedUser(authorizationHeader)`
- `hasRole(authorizationHeader, requiredRole)`
- `hasAnyRole(authorizationHeader, requiredRoles)`
- `hasPermission(authorizationHeader, permission)`

Permission model is currently static in `AuthorizationService` (`ROLE_PERMISSIONS` map).

Example:

```java
boolean allowed = authorizationService.hasPermission(header, "alerts:manage");
if (!allowed) {
    throw new IllegalArgumentException("User has no permission");
}
```

## 401 vs 403 Behavior

- `401 Unauthorized`
  - Returned when resource requires authentication and request is anonymous/invalid token.
  - Built by `RestAuthenticationEntryPoint`.
- `403 Forbidden`
  - Returned when request is authenticated but not authorized for a resource.

## Common Extension Tasks

### Add a new role

1. Add role in domain enum:
   - `src/main/java/unicauca/edu/co/API/Domain/Model/UserRole.java`
2. Update role mapping in adapter:
   - `src/main/java/unicauca/edu/co/API/DataAccess/Adapter/UserPersistenceAdapter.java`
3. Update DB enum constraints/migration for `user.role`.
4. Update permission map in `AuthorizationService`.
5. Add or adjust `@PreAuthorize` expressions.

### Add a new permission

1. Add permission key in `ROLE_PERMISSIONS`.
2. Use `hasPermission(...)` where needed.
3. Add tests for allowed and denied scenarios.

## Manual Validation Checklist

Use these checks after security changes:

1. Request protected endpoint without token -> expect `401`.
2. Request protected endpoint with invalid/expired token -> expect `401`.
3. Request protected endpoint with valid token -> expect `200` or domain-specific response.
4. Request role-restricted endpoint with insufficient role -> expect `403`.

## Troubleshooting

- Endpoint is accessible without token:
  - verify `@PreAuthorize` exists on method/class.
  - verify `@EnableMethodSecurity` is present.
- Always getting 401 with valid Firebase token:
  - check `iss` and `aud` claims.
  - verify Firebase credentials loaded correctly.
- Role checks fail unexpectedly:
  - ensure role persisted in DB matches domain role.
  - ensure granted authority format is `ROLE_<UPPERCASE_ROLE>`.
