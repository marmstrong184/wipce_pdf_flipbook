#/bin/bash
npx local-web-server \
  --https \
  --cors.embedder-policy "require-corp"\
  --cors.opener-policy "same-origin" \
  --directory . \
  --hostname 0.0.0.0 \
  --port 8090

# Omit --hostname if you don't want to expose your device over the local network
# See https://github.com/godotengine/godot/issues/69020
