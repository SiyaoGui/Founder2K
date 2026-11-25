set -eu
cd /workspace/sites-validation
instance=$(pgrep -af '^.*[/]livekit-server --config /tmp/founder2k-rehearsal-'| head -1 | sed -n 's|.*--config \(/tmp/founder2k-rehearsal-[^/]\+\)/sfu.yml.*|\1|p')
test -d "$instance"
node tests/rehearsal/modes.mjs seed "$instance/modes.sql" "$instance/modes.json"
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to "$instance" --file "$instance/modes.sql" > /tmp/f2k-modes-seed-log
node tests/rehearsal/modes.mjs run "$instance/modes.sql" "$instance/modes.json"
