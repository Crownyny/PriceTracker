# Security Package Guide

## Objetivo
Documentar el flujo de autenticacion/autorizacion HTTP implementado con Spring Security.

## Componentes
- `SecurityConfig`: define `SecurityFilterChain`, `@EnableMethodSecurity`, manejo de 401/403 y registro del filtro JWT.
- `JwtAuthenticationFilter`: extrae bearer token, valida claims, resuelve usuario y carga `SecurityContext`.
- `RestAuthenticationEntryPoint`: respuesta JSON para `401 Unauthorized`.
- `AuthenticatedUserPrincipal`: principal almacenado en contexto de seguridad.

## Flujo resumido
1. Toda request pasa por `JwtAuthenticationFilter`.
2. Si hay token bearer valido, se construye `UsernamePasswordAuthenticationToken`.
3. Si no hay token o token invalido, la request continua sin autenticacion.
4. Los endpoints protegidos por `@PreAuthorize` retornan `401` cuando no hay sesion valida.

## Convencion
- La proteccion principal se declara a nivel de metodo (`@PreAuthorize`).
- Mantener filtros y configuracion sin logica de negocio de dominio.
