/**
 * OpenTelemetry Configuration
 * 
 * Implements distributed tracing for ClawZz.
 * Ensures every request has a unique trace ID that propagates across services.
 * 
 * @see https://opentelemetry.io/docs/instrumentation/js/getting-started/nodejs/
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { logger } from "../utils/logger.js";

/**
 * Initialize OpenTelemetry SDK
 * 
 * Configures:
 * 1. Resource metadata (service name, version)
 * 2. OTLP Trace Exporter (sends to OTel collector)
 * 3. Auto-instrumentation (Express, HTTP, PG, Redis, etc.)
 */
const sdk = new NodeSDK({
  resource: new Resource({
    "service.name": "clawzz-api",
    "service.version": process.env.APP_VERSION || "0.0.1",
    "deployment.environment": process.env.NODE_ENV || "development",
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces",
    headers: {},
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Disable noisy instrumentations if needed
      "@opentelemetry/instrumentation-fs": {
        enabled: false,
      } as any,
    }),
  ],
});

/**
 * Start the OTel SDK
 */
export function initializeOTel(): void {
  if (process.env.ENABLE_OTEL !== "true") {
    logger.info("OpenTelemetry is disabled (ENABLE_OTEL != true)");
    return;
  }

  try {
    sdk.start();
    logger.info("✅ OpenTelemetry initialized and started");

    // Graceful shutdown
    process.on("SIGTERM", () => {
      sdk.shutdown()
        .then(() => logger.info("OpenTelemetry terminated"))
        .catch((error) => logger.error("Error terminating OpenTelemetry", error))
        .finally(() => process.exit(0));
    });
  } catch (error) {
    logger.error("Failed to initialize OpenTelemetry", error);
  }
}

export default sdk;
