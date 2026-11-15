"""Esquema inicial: las nueve tablas del dominio (0001).

Revision ID: 0001_esquema_inicial
Revises:
Create Date: 2026-11-15 19:26:02.105138

Generada con ``alembic revision --autogenerate`` contra una base vacía y
revisada a mano. Reproduce lo que antes creaba
``SQLModel.metadata.create_all``: nueve tablas en orden de dependencias, cinco
``UNIQUE``, siete ``CHECK``, las claves foráneas con su nombre y sus índices.

Autogenerate emite los ``CHECK`` al crear una tabla nueva, pero no los compara
ni los detecta en una tabla existente: al agregar restricciones en el futuro
hay que escribirlas a mano en la revisión y comprobarlas con
``SELECT conname FROM pg_constraint``.
"""
from alembic import op
import sqlalchemy as sa


# Identificadores de la revisión usados por Alembic.
revision = "0001_esquema_inicial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "autor",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("nacionalidad", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "cliente",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_cliente_email"),
    )
    op.create_table(
        "editorial",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("pais", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_editorial_nombre"),
    )
    op.create_table(
        "genero",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_genero_nombre"),
    )
    op.create_table(
        "libro",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("isbn", sa.String(length=255), nullable=False),
        sa.Column("titulo", sa.String(length=255), nullable=False),
        sa.Column("precio", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("stock", sa.Integer(), nullable=False),
        sa.Column("editorial_id", sa.Integer(), nullable=False),
        sa.Column("genero_id", sa.Integer(), nullable=True),
        sa.CheckConstraint("precio > 0", name="ck_libro_precio_positivo"),
        sa.CheckConstraint("stock >= 0", name="ck_libro_stock_no_negativo"),
        sa.ForeignKeyConstraint(
            ["editorial_id"], ["editorial.id"], name="fk_libro_editorial_id"
        ),
        sa.ForeignKeyConstraint(
            ["genero_id"], ["genero.id"], name="fk_libro_genero_id"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("isbn", name="uq_libro_isbn"),
    )
    op.create_index(
        op.f("ix_libro_editorial_id"), "libro", ["editorial_id"], unique=False
    )
    op.create_index(op.f("ix_libro_genero_id"), "libro", ["genero_id"], unique=False)
    op.create_index("ix_libro_titulo", "libro", ["titulo"], unique=False)
    op.create_table(
        "perfil_cliente",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column("telefono", sa.String(length=255), nullable=False),
        sa.Column("direccion", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(
            ["cliente_id"], ["cliente.id"], name="fk_perfil_cliente_cliente_id"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("cliente_id", name="uq_perfil_cliente_cliente_id"),
    )
    op.create_index(
        op.f("ix_perfil_cliente_cliente_id"),
        "perfil_cliente",
        ["cliente_id"],
        unique=False,
    )
    op.create_table(
        "venta",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.CheckConstraint("total >= 0", name="ck_venta_total_no_negativo"),
        sa.ForeignKeyConstraint(
            ["cliente_id"], ["cliente.id"], name="fk_venta_cliente_id"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_venta_cliente_id"), "venta", ["cliente_id"], unique=False)
    op.create_table(
        "libro_autor",
        sa.Column("libro_id", sa.Integer(), nullable=False),
        sa.Column("autor_id", sa.Integer(), nullable=False),
        sa.Column("rol", sa.String(length=20), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "rol IN ('autor', 'coautor', 'traductor', 'ilustrador')",
            name="ck_libro_autor_rol",
        ),
        sa.CheckConstraint("orden >= 1", name="ck_libro_autor_orden"),
        sa.ForeignKeyConstraint(
            ["autor_id"], ["autor.id"], name="fk_libro_autor_autor_id"
        ),
        sa.ForeignKeyConstraint(
            ["libro_id"], ["libro.id"], name="fk_libro_autor_libro_id"
        ),
        sa.PrimaryKeyConstraint("libro_id", "autor_id"),
    )
    op.create_index(
        op.f("ix_libro_autor_autor_id"), "libro_autor", ["autor_id"], unique=False
    )
    op.create_table(
        "renglon_venta",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("venta_id", sa.Integer(), nullable=False),
        sa.Column("libro_id", sa.Integer(), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("precio_unitario", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.CheckConstraint(
            "cantidad > 0", name="ck_renglon_venta_cantidad_positiva"
        ),
        sa.CheckConstraint(
            "precio_unitario > 0", name="ck_renglon_venta_precio_positivo"
        ),
        sa.ForeignKeyConstraint(
            ["libro_id"], ["libro.id"], name="fk_renglon_venta_libro_id"
        ),
        sa.ForeignKeyConstraint(
            ["venta_id"],
            ["venta.id"],
            name="fk_renglon_venta_venta_id",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_renglon_venta_libro_id"), "renglon_venta", ["libro_id"], unique=False
    )
    op.create_index(
        op.f("ix_renglon_venta_venta_id"), "renglon_venta", ["venta_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_renglon_venta_venta_id"), table_name="renglon_venta")
    op.drop_index(op.f("ix_renglon_venta_libro_id"), table_name="renglon_venta")
    op.drop_table("renglon_venta")
    op.drop_index(op.f("ix_libro_autor_autor_id"), table_name="libro_autor")
    op.drop_table("libro_autor")
    op.drop_index(op.f("ix_venta_cliente_id"), table_name="venta")
    op.drop_table("venta")
    op.drop_index(op.f("ix_perfil_cliente_cliente_id"), table_name="perfil_cliente")
    op.drop_table("perfil_cliente")
    op.drop_index("ix_libro_titulo", table_name="libro")
    op.drop_index(op.f("ix_libro_genero_id"), table_name="libro")
    op.drop_index(op.f("ix_libro_editorial_id"), table_name="libro")
    op.drop_table("libro")
    op.drop_table("genero")
    op.drop_table("editorial")
    op.drop_table("cliente")
    op.drop_table("autor")
