# ClawZz Coturn Dockerfile
# Custom TURN server for WebRTC audio rooms

FROM coturn/coturn:4.6.3

LABEL maintainer="ClawZz Team"
LABEL description="Coturn TURN server for ClawZz audio rooms"

# Create log directory
RUN mkdir -p /var/log/turnserver

# Copy configuration
COPY turnserver.conf /etc/turnserver.conf

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

# Entry point with secret injection
ENTRYPOINT ["/bin/sh", "-c"]
CMD ["turnserver -c /etc/turnserver.conf --static-auth-secret=$COTURN_SECRET --external-ip=$COTURN_EXTERNAL_IP"]
