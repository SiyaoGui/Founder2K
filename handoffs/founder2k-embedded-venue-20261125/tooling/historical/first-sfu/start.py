from pathlib import Path
import secrets
d=Path('/tmp/venue-sfu')
key='rehearsal';secret=secrets.token_hex(32);clock=secrets.token_hex(32)
(d/'config.yaml').write_text(f"""port: 7880
bind_addresses: ["127.0.0.1"]
rtc:
  node_ip: 127.0.0.1
  use_external_ip: false
  tcp_port: 7881
  udp_port: 7882
  enable_loopback_candidate: true
room:
  auto_create: false
keys:
  {key}: {secret}
webhook:
  api_key: {key}
  urls: ["http://127.0.0.1:8790/api/venue/webhook"]
""")
Path('dist/server/.dev.vars').write_text(f"LIVEKIT_URL=ws://127.0.0.1:7880\nLIVEKIT_API_KEY={key}\nLIVEKIT_API_SECRET={secret}\nVENUE_CLOCK_KEY={clock}\nFOUNDER2K_ADMIN_EMAIL=host@venue.test\n")
