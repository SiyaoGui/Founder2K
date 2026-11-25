from pathlib import Path
import re,secrets
s=Path('/tmp/venue-sfu/config.yaml').read_text()
secret=re.search(r'  rehearsal: (\w+)',s).group(1)
v=Path('dist/server/.dev.vars')
v.parent.mkdir(parents=True,exist_ok=True)
v.write_text(f"LIVEKIT_URL=ws://127.0.0.1:7880\nLIVEKIT_API_KEY=rehearsal\nLIVEKIT_API_SECRET={secret}\nVENUE_CLOCK_KEY={secrets.token_hex(32)}\nFOUNDER2K_ADMIN_EMAIL=host@venue.test\n")
