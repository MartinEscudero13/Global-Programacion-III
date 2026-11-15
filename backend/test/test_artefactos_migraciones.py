"""Contrato estático de las migraciones con Alembic (C.12 del Global).

Estos tests no tocan la base ni Docker: verifican la forma de ``alembic.ini``,
``migrations/env.py``, la revisión inicial, el ``Dockerfile`` y la ausencia de
DDL en el código de ejecución. La equivalencia real entre migración y modelo se
comprueba con ``alembic upgrade head`` y ``alembic check`` sobre una base
limpia, y con la consulta a ``pg_constraint`` del apply.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
ALEMBIC_INI = RAIZ / "alembic.ini"
MIGRACIONES = RAIZ / "migrations"
ENV = MIGRACIONES / "env.py"
VERSIONES = MIGRACIONES / "versions"
REQUIREMENTS = RAIZ / "requirements.txt"
DOCKERFILE = RAIZ / "Dockerfile"
MAIN = RAIZ / "app" / "main.py"
SEED = RAIZ / "app" / "seed.py"

MODULOS_MODELOS = (
    "app.modules.autores",
    "app.modules.clientes",
    "app.modules.editoriales",
    "app.modules.generos",
    "app.modules.libros",
    "app.modules.ventas",
)

TABLAS = (
    "autor",
    "cliente",
    "perfil_cliente",
    "editorial",
    "genero",
    "libro",
    "libro_autor",
    "venta",
    "renglon_venta",
)

RESTRICCIONES = (
    "uq_cliente_email",
    "uq_perfil_cliente_cliente_id",
    "uq_editorial_nombre",
    "uq_genero_nombre",
    "uq_libro_isbn",
    "ck_libro_precio_positivo",
    "ck_libro_stock_no_negativo",
    "ck_libro_autor_rol",
    "ck_libro_autor_orden",
    "ck_venta_total_no_negativo",
    "ck_renglon_venta_cantidad_positiva",
    "ck_renglon_venta_precio_positivo",
)


def _leer(ruta: Path) -> str:
    assert ruta.is_file(), f"falta el artefacto {ruta}"
    return ruta.read_text(encoding="utf-8")


def _revision_inicial() -> Path:
    """Devuelve la única revisión con ``down_revision`` nula."""
    candidatas = []
    for ruta in sorted(VERSIONES.glob("*.py")):
        texto = ruta.read_text(encoding="utf-8")
        if re.search(r"^down_revision = None$", texto, re.MULTILINE):
            candidatas.append(ruta)
    assert len(candidatas) == 1, (
        "debe existir exactamente una revisión inicial con down_revision = None; "
        f"encontradas: {[ruta.name for ruta in candidatas]}"
    )
    return candidatas[0]


# --- requirements.txt -----------------------------------------------------


def test_requirements_declara_alembic_con_version_fija() -> None:
    lineas = [linea.strip() for linea in _leer(REQUIREMENTS).splitlines()]
    versiones = [linea for linea in lineas if linea.startswith("alembic==")]
    assert len(versiones) == 1, f"falta alembic==<version> en requirements.txt: {lineas}"
    assert re.fullmatch(r"alembic==\d+(\.\d+)+", versiones[0]), versiones[0]


# --- alembic.ini ----------------------------------------------------------


def test_alembic_ini_apunta_a_migrations_y_no_lleva_url() -> None:
    texto = _leer(ALEMBIC_INI)
    assert "script_location = migrations" in texto
    assert "prepend_sys_path = ." in texto
    assert re.search(r"^sqlalchemy\.url =\s*$", texto, re.MULTILINE), (
        "sqlalchemy.url debe quedar vacío: la URL entra por el entorno"
    )
    assert "postgresql" not in texto
    assert not re.search(r"://", texto), "alembic.ini no debe contener una URL"


# --- migrations/env.py ----------------------------------------------------


def test_env_usa_la_configuracion_de_la_aplicacion() -> None:
    texto = _leer(ENV)
    assert "from app.core.config import get_settings" in texto
    assert "get_settings()" in texto
    assert "async_engine_from_config" in texto
    assert "connection.run_sync(do_run_migrations)" in texto
    assert "poolclass=pool.NullPool" in texto
    assert "compare_type=True" in texto
    assert "target_metadata = SQLModel.metadata" in texto
    assert not re.search(r"postgresql\+asyncpg://", texto), (
        "env.py no debe contener una URL literal"
    )


@pytest.mark.parametrize("modulo", MODULOS_MODELOS)
def test_env_registra_los_seis_modulos_de_modelos(modulo: str) -> None:
    texto = _leer(ENV)
    assert re.search(rf"^from {re.escape(modulo)} import models", texto, re.MULTILINE), (
        f"env.py no importa los modelos de {modulo}: el metadata quedaría incompleto"
    )


def test_env_escapa_el_porcentaje_de_la_url() -> None:
    texto = _leer(ENV)
    assert 'replace("%", "%%")' in texto, (
        "la contraseña con % rompería configparser sin escapar"
    )


# --- Revisión inicial -----------------------------------------------------


def test_revision_inicial_se_llama_0001() -> None:
    ruta = _revision_inicial()
    assert ruta.name == "0001_esquema_inicial.py", ruta.name
    texto = ruta.read_text(encoding="utf-8")
    assert re.search(r'^revision = "0001_esquema_inicial"$', texto, re.MULTILINE)


def _bloques_create_table(texto: str) -> dict[str, str]:
    """Devuelve ``{tabla: bloque}`` con el DDL de cada ``op.create_table``."""
    bloques = re.split(r"op\.create_table\(", texto)[1:]
    resultado: dict[str, str] = {}
    for bloque in bloques:
        coincidencia = re.match(r'\s*"(\w+)"', bloque)
        assert coincidencia is not None, "create_table sin nombre de tabla"
        resultado[coincidencia.group(1)] = bloque
    return resultado


def test_revision_inicial_crea_las_nueve_tablas_en_orden_de_dependencias() -> None:
    texto = _revision_inicial().read_text(encoding="utf-8")
    bloques = _bloques_create_table(texto.split("def downgrade", 1)[0])
    assert set(bloques) == set(TABLAS), f"faltan o sobran tablas: {sorted(bloques)}"

    for posicion, (tabla, bloque) in enumerate(bloques.items()):
        referencias = re.findall(r'ForeignKeyConstraint\([^)]*\["(\w+)\.', bloque)
        for referenciada in referencias:
            if referenciada == tabla:
                continue
            assert referenciada in bloques, (
                f"{tabla} referencia una tabla inexistente: {referenciada}"
            )
            assert list(bloques).index(referenciada) < posicion, (
                f"{tabla} se crea antes que su dependencia {referenciada}"
            )


@pytest.mark.parametrize("restriccion", RESTRICCIONES)
def test_revision_inicial_declara_las_restricciones_con_nombre(restriccion: str) -> None:
    texto = _revision_inicial().read_text(encoding="utf-8")
    assert f'name="{restriccion}"' in texto, f"falta la restricción {restriccion}"


def test_revision_inicial_elimina_en_orden_inverso() -> None:
    texto = _revision_inicial().read_text(encoding="utf-8")
    upgrade, downgrade = texto.split("def downgrade() -> None:", 1)
    creadas = re.findall(r'op\.create_table\(\s*"(\w+)"', upgrade)
    eliminadas = re.findall(r'op\.drop_table\("(\w+)"\)', downgrade)
    assert eliminadas == list(reversed(creadas)), (
        "el downgrade debe eliminar en orden inverso al upgrade; "
        f"creadas: {creadas}; eliminadas: {eliminadas}"
    )


# --- Dockerfile -----------------------------------------------------------


def test_dockerfile_copia_las_migraciones_ejecuta_upgrade_y_cede_el_proceso() -> None:
    texto = _leer(DOCKERFILE)
    assert "COPY alembic.ini ./alembic.ini" in texto
    assert "COPY migrations ./migrations" in texto
    assert "alembic upgrade head && exec uvicorn app.main:app" in texto
    assert "--host 0.0.0.0 --port 8000" in texto


# --- Código de ejecución sin DDL ------------------------------------------


@pytest.mark.parametrize("ruta", [MAIN, SEED], ids=["main", "seed"])
def test_el_codigo_de_ejecucion_no_crea_el_esquema(ruta: Path) -> None:
    texto = _leer(ruta)
    assert "create_all" not in texto, (
        f"{ruta.name} no debe crear el esquema: Alembic es la única fuente"
    )
    assert "metadata.create" not in texto
