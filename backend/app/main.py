"""Punto de entrada de la aplicación: fábrica, lifespan y routers."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.database import build_engine, build_session_factory
from app.core.logging import configurar_logging
from app.modules.autores.router import router as autores_router
from app.modules.clientes.router import router as clientes_router
from app.modules.editoriales.router import router as editoriales_router
from app.modules.generos.router import router as generos_router
from app.modules.health.router import router as health_router
from app.modules.libros.router import router as libros_router
from app.modules.ventas.router import router as ventas_router

# Las nueve tablas del dominio viven en `app/modules/*/models.py`. Los imports
# se conservan porque completan el registro de clases que SQLAlchemy necesita
# para resolver las relaciones declaradas por cadena; el esquema lo crea y lo
# cambia Alembic (`alembic upgrade head`), nunca este módulo. `health` no define
# tablas.
from app.modules.autores import models as _autores_models  # noqa: F401
from app.modules.clientes import models as _clientes_models  # noqa: F401
from app.modules.editoriales import models as _editoriales_models  # noqa: F401
from app.modules.generos import models as _generos_models  # noqa: F401
from app.modules.libros import models as _libros_models  # noqa: F401
from app.modules.ventas import models as _ventas_models  # noqa: F401


@asynccontextmanager
async def lifespan(aplicacion: FastAPI) -> AsyncIterator[None]:
    """Crea el motor y la fábrica al arrancar y libera el motor al apagar.

    No abre transacciones ni ejecuta DDL: el esquema llega migrado por Alembic.
    """
    settings = get_settings()
    engine = build_engine(settings)
    aplicacion.state.engine = engine
    aplicacion.state.session_factory = build_session_factory(engine)
    try:
        yield
    finally:
        await engine.dispose()


def create_app() -> FastAPI:
    """Arma la aplicación; no abre conexiones hasta que corre el lifespan."""
    configurar_logging()
    aplicacion = FastAPI(
        title="Librería de barrio",
        description="API de catálogo y ventas (Parcial Cap. 1 a 4).",
        version="0.1.0",
        lifespan=lifespan,
    )
    aplicacion.include_router(health_router)
    aplicacion.include_router(editoriales_router)
    aplicacion.include_router(generos_router)
    aplicacion.include_router(autores_router)
    aplicacion.include_router(clientes_router)
    aplicacion.include_router(libros_router)
    aplicacion.include_router(ventas_router)
    return aplicacion


app = create_app()
