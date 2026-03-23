#!/usr/bin/env python3
"""
Redis ↔ Postgres bridge for NanoClaw multi-agent communication.

Subscribes to all agent inbox channels (agent:*:inbox) via Redis PSUBSCRIBE,
persists every message to the Postgres `messages` table, and optionally
forwards tasks to the `tasks` table.

Usage:
    python redis_pubsub.py                # run as a long-lived daemon
    python -c "from redis_pubsub import publish; publish('agent-1','agent-2','hello')"
"""

import json
import os
import signal
import sys
import time

import psycopg2
import psycopg2.pool
import redis

# ── Config ────────────────────────────────────────────────────────
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://nanoclaw:changeme@localhost:5432/nanoclaw",
)
CHANNEL_PATTERN = "agent:*:inbox"

# ── Connections ───────────────────────────────────────────────────
_redis_client: redis.Redis | None = None
_pg_pool: psycopg2.pool.SimpleConnectionPool | None = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


def get_pg_pool() -> psycopg2.pool.SimpleConnectionPool:
    global _pg_pool
    if _pg_pool is None:
        _pg_pool = psycopg2.pool.SimpleConnectionPool(1, 5, DATABASE_URL)
    return _pg_pool


# ── Publish helper (importable) ──────────────────────────────────
def publish(from_agent: str, to_agent: str, message: str) -> None:
    """Publish a message to the target agent's Redis inbox channel."""
    payload = json.dumps(
        {"from_agent": from_agent, "to_agent": to_agent, "message": message}
    )
    channel = f"agent:{to_agent}:inbox"
    get_redis().publish(channel, payload)
    _persist_message(from_agent, to_agent, channel, message)
    print(f"[pub] {from_agent} → {to_agent}: {message[:80]}")


# ── Subscribe & relay (daemon mode) ──────────────────────────────
def subscribe(callback=None):
    """Block and listen for messages on all agent inbox channels."""
    r = get_redis()
    ps = r.pubsub()
    ps.psubscribe(CHANNEL_PATTERN)
    print(f"[sub] Listening on pattern: {CHANNEL_PATTERN}")

    for raw in ps.listen():
        if raw["type"] != "pmessage":
            continue
        try:
            data = json.loads(raw["data"])
            from_agent = data["from_agent"]
            to_agent = data["to_agent"]
            message = data["message"]
            channel = raw["channel"]

            _persist_message(from_agent, to_agent, channel, message)
            _create_task(from_agent, to_agent, message)

            print(f"[relay] {from_agent} → {to_agent} on {channel}")

            if callback:
                callback(data)
        except (json.JSONDecodeError, KeyError) as exc:
            print(f"[warn] Bad message on {raw['channel']}: {exc}")


# ── Postgres helpers ──────────────────────────────────────────────
def _persist_message(
    from_agent: str, to_agent: str, channel: str, content: str
) -> None:
    pool = get_pg_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO messages (from_agent, to_agent, channel, content)
                   VALUES (%s, %s, %s, %s)""",
                (from_agent, to_agent, channel, content),
            )
        conn.commit()
    finally:
        pool.putconn(conn)


def _create_task(from_agent: str, to_agent: str, message: str) -> None:
    pool = get_pg_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO tasks (from_agent, to_agent, message, status)
                   VALUES (%s, %s, %s, 'pending')""",
                (from_agent, to_agent, message),
            )
        conn.commit()
    finally:
        pool.putconn(conn)


def _log(agent_id: str, level: str, message: str) -> None:
    pool = get_pg_pool()
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO agent_logs (agent_id, level, message)
                   VALUES (%s, %s, %s)""",
                (agent_id, level, message),
            )
        conn.commit()
    finally:
        pool.putconn(conn)


# ── Entrypoint ────────────────────────────────────────────────────
def _shutdown(signum, frame):
    print("\n[bridge] Shutting down…")
    if _pg_pool:
        _pg_pool.closeall()
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # Wait for dependencies to become available
    for attempt in range(10):
        try:
            get_redis().ping()
            pool = get_pg_pool()
            conn = pool.getconn()
            conn.cursor().execute("SELECT 1")
            pool.putconn(conn)
            break
        except Exception as exc:
            wait = min(2**attempt, 30)
            print(f"[bridge] Waiting for deps ({exc})… retry in {wait}s")
            time.sleep(wait)
    else:
        print("[bridge] Could not connect to Redis/Postgres after 10 attempts")
        sys.exit(1)

    _log("redis-bridge", "info", "Bridge started — listening for messages")
    subscribe()


if __name__ == "__main__":
    main()
