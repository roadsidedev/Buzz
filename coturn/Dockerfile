# Beely Coturn Dockerfile
# Custom TURN server for WebRTC audio rooms

FROM coturn/coturn:4.6.3

LABEL maintainer="Beely Team"
LABEL description="Coturn TURN server for Beely audio rooms"

# Copy static configuration and the entrypoint that injects secrets at runtime.
COPY turnserver.conf /etc/coturn/turnserver.conf.tmpl
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose ports
# STUN/TURN
EXPOSE 3478/udp
EXPOSE 3478/tcp
EXPOSE 5349/tcp

# Relay ports
EXPOSE 49152-65535/udp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD turnadmin -l -N localhost || exit 1

# The entrypoint writes COTURN_SECRET / COTURN_EXTERNAL_IP into the config file
# at startup so neither value appears in process args or `docker inspect` output (M11).
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["turnserver"]
