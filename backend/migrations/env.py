"""Entorno de Alembic para la API de la librería.

La URL de conexión no vive en `alembic.ini`: se lee de `DATABASE_URL` con la
misma función que valida el arranque de la aplicación (`get_settings`), de modo
que el mensaje de error por variable faltante o por driver equivocado es único.

El motor es asincrónico (`async_engine_from_config` + `connection.run_sync`),
igual que la API. Los seis imports de `models` completan `SQLModel.metadata`
con las nueve tablas del dominio, sin las cuales `--autogenerate` propondría
borrar lo que no ve.
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlmodel import SQLModel

from app.core.config import get_settings

# Los modelos deben importarse para que el metadata tenga las nueve tablas.
from app.modules.autores import models as _autores_models  # noqa: F401
from app.modules.clientes import models as _clientes_models  # noqa: F401
from app.modules.editoriales import models as _editoriales_models  # noqa: F401
from app.modules.generos import models as _generos_models  # noqa: F401
from app.modules.libros import models as _libros_models  # noqa: F401
from app.modules.ventas import models as _ventas_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def _url_de_la_base() -> str:
    """Devuelve la URL validada, escapada para configparser."""
    return get_settings().database_url.replace("%", "%%")


def run_migrations_offline() -> None:
    """Genera el SQL sin conectarse, con la misma URL del entorno."""
    context.configure(
        url=_url_de_la_base(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Configura el contexto sobre una conexión ya abierta."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Abre el motor asincrónico y aplica las migraciones dentro de él."""
    config.set_main_option("sqlalchemy.url", _url_de_la_base())
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Punto de entrada del modo conectado."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
