"""Pruebas del arranque y apagado de la aplicación (D-07).

El esquema lo aplica Alembic antes de arrancar; el ``lifespan`` sólo construye
el motor y la fábrica de sesiones, así que ninguna prueba de este módulo espera
DDL en el arranque.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel

from app.core.config import ConfigurationError
from app.main import create_app

URL = "postgresql+asyncpg://usuario:secreto@localhost:5432/libreria"


class _ConexionFalsa:
    def __init__(self) -> None:
        self.ejecutadas: list[object] = []

    async def run_sync(self, funcion: object) -> None:
        self.ejecutadas.append(funcion)


class _ContextoDeMotorFalso:
    def __init__(self, conexion: _ConexionFalsa) -> None:
        self._conexion = conexion

    async def __aenter__(self) -> _ConexionFalsa:
        return self._conexion

    async def __aexit__(self, *exc_info: object) -> bool:
        return False


class _MotorFalso:
    def __init__(self) -> None:
        self.conexion = _ConexionFalsa()
        self.veces_que_abrio_transaccion = 0
        self.dispose_invocado = False

    def begin(self) -> _ContextoDeMotorFalso:
        self.veces_que_abrio_transaccion += 1
        return _ContextoDeMotorFalso(self.conexion)

    async def dispose(self) -> None:
        self.dispose_invocado = True


@pytest.fixture(autouse=True)
def entorno_aislado(tmp_path, monkeypatch):
    """Aísla cada prueba de un `.env` real y de variables heredadas."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("DATABASE_URL", raising=False)


def _sustituir_motor(monkeypatch, motor: _MotorFalso, fabrica: object) -> None:
    monkeypatch.setattr("app.main.build_engine", lambda settings: motor)
    monkeypatch.setattr("app.main.build_session_factory", lambda engine: fabrica)


async def test_lifespan_sin_database_url_falla_nombrando_la_variable():
    aplicacion = create_app()

    with pytest.raises(ConfigurationError) as excinfo:
        async with aplicacion.router.lifespan_context(aplicacion):
            pass

    assert "DATABASE_URL" in str(excinfo.value)


async def test_create_app_no_construye_el_motor_fuera_del_lifespan(monkeypatch):
    def _no_debe_llamarse(settings):
        raise AssertionError("build_engine no debe ejecutarse al crear la app")

    monkeypatch.setattr("app.main.build_engine", _no_debe_llamarse)

    create_app()


async def test_lifespan_publica_motor_y_fabrica_en_el_estado(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", URL)
    motor = _MotorFalso()
    fabrica = object()
    _sustituir_motor(monkeypatch, motor, fabrica)
    aplicacion = create_app()

    async with aplicacion.router.lifespan_context(aplicacion):
        assert aplicacion.state.engine is motor
        assert aplicacion.state.session_factory is fabrica


async def test_lifespan_libera_el_motor_al_apagar(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", URL)
    motor = _MotorFalso()
    _sustituir_motor(monkeypatch, motor, object())
    aplicacion = create_app()

    async with aplicacion.router.lifespan_context(aplicacion):
        assert motor.dispose_invocado is False

    assert motor.dispose_invocado is True


async def test_lifespan_no_abre_transaccion_ni_ejecuta_ddl(monkeypatch):
    """Alembic es la única fuente del esquema: el arranque no define DDL."""
    monkeypatch.setenv("DATABASE_URL", URL)
    motor = _MotorFalso()
    _sustituir_motor(monkeypatch, motor, object())
    aplicacion = create_app()

    async with aplicacion.router.lifespan_context(aplicacion):
        assert motor.veces_que_abrio_transaccion == 0

    assert motor.veces_que_abrio_transaccion == 0
    assert motor.conexion.ejecutadas == []
    assert motor.dispose_invocado is True


@pytest.mark.integration
async def test_arranque_sobre_base_sin_migrar_no_crea_tablas(url_bd_test, monkeypatch):
    """Triangulación real: contra PostgreSQL vacío, arrancar no crea tablas."""
    motor_verificacion = create_async_engine(url_bd_test)
    try:
        async with motor_verificacion.begin() as conexion:
            await conexion.run_sync(SQLModel.metadata.drop_all)

        monkeypatch.setenv("DATABASE_URL", url_bd_test)
        aplicacion = create_app()
        async with aplicacion.router.lifespan_context(aplicacion):
            pass

        async with motor_verificacion.connect() as conexion:
            resultado = await conexion.execute(
                text(
                    "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' "
                    "AND tablename <> 'alembic_version'"
                )
            )
            assert resultado.scalar_one() == 0
    finally:
        await motor_verificacion.dispose()
