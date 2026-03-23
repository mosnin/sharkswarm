#!/usr/bin/env python3
"""
Redis Pub/Sub helper for OpenClaw inter-agent communication.

Usage:
  # As a subscriber (listen for messages to agent-1):
  python redis_pubsub.py subscribe agent-1

  # As a publisher (send message from agent-1 to agent-2):
  python redis_pubsub.py publish agent-1 agent-2 "Hello from agent-1"

  # As a relay bridge (logs all messages to Postgres):
  python redis_pubsub.py relay

Can also be imported as a module:
  from redis_pubsub import publish_message, subscribe_to_agent
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

import psycopg2
import redis

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://openclaw:changeme@localhost:5432/openclaw"
)


def get_redis() -> redis.Redis:
    return redis.Redis.from_url(REDIS_URL, decode_responses=True)


def get_pg():
    return psycopg2.connect(DATABASE_URL)


def channel_for(agent_id: str) -> str:
    """Return the Redis channel name for an agent's inbox."""
    return f"agent:{agent_id}:inbox"


# ── Publishing ────────────────────────────────────────────────────


def publish_message(from_agent: str, to_agent: str, message: str, log_to_db: bool = True):
    """Publish a message to a target agent's Redis inbox and optionally log to Postgres."""
    r = get_redis()
    payload = json.dumps(
        {
            "from": from_agent,
            "to": to_agent,
            "content": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )
    channel = channel_for(to_agent)
    r.publish(channel, payload)
    print(f"[PUB] {from_agent} -> {to_agent} on {channel}")

    if log_to_db:
        _log_message_to_db(from_agent, to_agent, channel, message)


def _log_message_to_db(from_agent: str, to_agent: str, channel: str, content: str):
    try:
        conn = get_pg()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO messages (from_agent, to_agent, channel, content) VALUES (%s, %s, %s, %s)",
                (from_agent, to_agent, channel, content),
            )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[WARN] Could not log to Postgres: {e}")


# ── Subscribing ───────────────────────────────────────────────────


def subscribe_to_agent(agent_id: str, callback=None):
    """Subscribe to an agent's inbox channel. Blocks and calls callback(message_dict) for each message."""
    r = get_redis()
    pubsub = r.pubsub()
    channel = channel_for(agent_id)
    pubsub.subscribe(channel)
    print(f"[SUB] Listening on {channel} ...")

    for raw in pubsub.listen():
        if raw["type"] != "message":
            continue
        try:
            data = json.loads(raw["data"])
        except json.JSONDecodeError:
            data = {"content": raw["data"]}

        print(f"[MSG] from={data.get('from', '?')} content={data.get('content', '')[:80]}")
        if callback:
            callback(data)


# ── Relay (subscribe to all, log to Postgres) ────────────────────


def relay():
    """Subscribe to all agent channels via pattern and log everything to Postgres."""
    r = get_redis()
    pubsub = r.pubsub()
    pubsub.psubscribe("agent:*:inbox")
    print("[RELAY] Listening on agent:*:inbox ...")

    for raw in pubsub.listen():
        if raw["type"] != "pmessage":
            continue
        try:
            data = json.loads(raw["data"])
            _log_message_to_db(
                data.get("from", "unknown"),
                data.get("to", "unknown"),
                raw.get("channel", ""),
                data.get("content", ""),
            )
            print(f"[RELAY] {data.get('from')} -> {data.get('to')}: {data.get('content', '')[:80]}")
        except Exception as e:
            print(f"[RELAY ERR] {e}")


# ── CLI ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "subscribe" and len(sys.argv) >= 3:
        subscribe_to_agent(sys.argv[2])
    elif cmd == "publish" and len(sys.argv) >= 5:
        publish_message(sys.argv[2], sys.argv[3], " ".join(sys.argv[4:]))
    elif cmd == "relay":
        relay()
    else:
        print(__doc__)
        sys.exit(1)
