"""Prepare local secrets and an isolated PostgreSQL cluster. Never start a service."""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
from tempfile import NamedTemporaryFile

from dotenv import dotenv_values


def prepare_database():
    """Create the application database after the shell script starts PostgreSQL."""
    import psycopg
    from psycopg import sql

    backend = Path(__file__).resolve().parent
    local = backend.parent / ".local"
    config = dotenv_values(backend / ".env")
    with psycopg.connect(
        dbname="postgres", user=config["DB_USER"], password=config["DB_PASSWORD"],
        host=str(local / "run"), port=5433, autocommit=True, connect_timeout=5,
    ) as connection:
        actual = Path(connection.execute("SHOW data_directory").fetchone()[0]).resolve()
        if actual != (local / "postgres").resolve():
            raise RuntimeError("Connected to a different PostgreSQL cluster; no database changes were made.")
        name = config["DB_NAME"]
        if not connection.execute("SELECT 1 FROM pg_database WHERE datname = %s", [name]).fetchone():
            connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
            print("Created the local application database.")


def main():
    backend = Path(__file__).resolve().parent
    local = backend.parent / ".local"
    data = local / "postgres"
    env_file = backend / ".env"
    initdb = shutil.which("initdb")
    if not initdb:
        sys.exit("PostgreSQL initdb is not on PATH. Add your PostgreSQL bin directory, then retry.")

    if not env_file.exists():
        if data.exists():
            sys.exit("The PostgreSQL directory already exists. Restore backend/.env before continuing.")
        secret = secrets.token_urlsafe(64)
        password = secrets.token_urlsafe(32)
        content = (backend / ".env.example").read_text()
        content = content.replace("replace-with-a-random-secret-of-at-least-50-characters", secret)
        content = content.replace("replace-with-a-random-local-database-password", password)
        descriptor = os.open(env_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as handle:
            handle.write(content)

    env = dotenv_values(env_file)
    expected = {"LOCAL_DEVELOPMENT": "true", "DB_USER": "inventory_manager", "DB_NAME": "inventory_manager", "DB_HOST": "127.0.0.1", "DB_PORT": "5433"}
    if any(env.get(key) != value for key, value in expected.items()):
        sys.exit("setup_local.py expects the local database values from .env.example. Your configuration was preserved.")
    password = env.get("DB_PASSWORD")
    if not password or password.startswith("replace-"):
        sys.exit("Set a random DB_PASSWORD in backend/.env first.")

    local.mkdir(mode=0o700, exist_ok=True)
    sockets = local / "run"
    sockets.mkdir(mode=0o700, exist_ok=True)
    if not (data / "PG_VERSION").exists():
        with NamedTemporaryFile(mode="w", dir=local, prefix=".pg-password-") as password_file:
            password_file.write(password + "\n")
            password_file.flush()
            subprocess.run(
                [initdb, "-D", str(data), "--username=inventory_manager", "--encoding=UTF8", "--locale=C", "--auth=scram-sha-256", f"--pwfile={password_file.name}"],
                check=True,
            )
    config = data / "inventory-manager-local.conf"
    socket_path = str(sockets).replace("'", "''")
    config.write_text(f"listen_addresses = '127.0.0.1'\nport = 5433\nunix_socket_directories = '{socket_path}'\n")
    main_config = data / "postgresql.conf"
    include = "include = 'inventory-manager-local.conf'"
    if include not in main_config.read_text():
        with main_config.open("a") as handle:
            handle.write(f"\n# Inventory Manager's isolated local development settings.\n{include}\n")
    print("Local configuration and PostgreSQL cluster are ready. No services were started.")
    print("make start will create the application database and apply migrations as needed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", action="store_true", help="Create the application database in the running project cluster.")
    if parser.parse_args().database:
        prepare_database()
    else:
        main()
