FROM alfg/nginx-rtmp

# Copy custom nginx config with HLS enabled
COPY nginx.conf /etc/nginx/nginx.conf

# RTMP ingest: 1935
# HLS + HTTP:   80
EXPOSE 1935 80
