"""
Proactive daily digest (parcours 19) — the agent "speaks first".

Once a day (opt-in, per user), the household receives a short digest aggregating
signals every module already knows how to compute: tasks due today, weather
alerts, low stock, an electricity anomaly, a drop in egg laying. It reuses the
``pings`` infrastructure end-to-end (opt-in preference + local send time,
idempotent scheduler tick, timezone + language handling, Telegram delivery), so
this package only owns the *composition* of the message.

Architecture: ``collectors`` turn each module's data into a ``DigestSection``
(blind to the others); ``service.build_digest`` assembles the active sections
for a household/user; ``ping.build_daily_digest_message`` is the ``PingSpec``
entry point; ``polish`` optionally rewrites the message with the LLM (off the
critical path, template fallback). Adding a section = one collector + one entry
in ``SECTION_SPECS``.
"""

DIGEST_PING_TYPE = "daily_digest"
