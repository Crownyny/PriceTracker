"""Validación del NormalizedProduct antes de persistirlo.

Usa Pydantic como motor de validación estructural (tipos, campos requeridos).
Este módulo añade validaciones de reglas de negocio adicionales.

Extender la clase ProductValidator para añadir más restricciones sin modificar
el modelo de datos compartido.
"""
import logging

from shared.model import NormalizedProduct

logger = logging.getLogger(__name__)


class ValidationError(Exception):
    """Error de validación de negocio sobre un producto normalizado."""
    pass


class ProductValidator:
    """
    Valida que un NormalizedProduct cumpla los requisitos mínimos de negocio.
    Lanza ValidationError con mensaje descriptivo si alguna regla falla.
    """

    def validate(self, product: NormalizedProduct) -> None:
        errors: list[str] = []

        if not product.canonical_name.strip():
            errors.append("canonical_name no puede estar vacío.")
        if product.price <= 0:
            errors.append(f"price inválido (debe ser > 0): {product.price}")
        if len(product.currency) != 3:
            errors.append(f"currency debe ser código ISO 4217 de 3 letras: '{product.currency}'")
        if not product.product_ref.strip():
            errors.append("product_ref no puede estar vacío.")
        if not product.source_name.strip():
            errors.append("source_name no puede estar vacío.")

        if errors:
            raise ValidationError(
                f"Producto inválido [{product.source_name}/{product.product_ref}]: "
                + "; ".join(errors)
            )

        logger.debug(
            "Producto válido: %s / %s (%.2f %s)",
            product.source_name, product.product_ref, product.price, product.currency,
        )
