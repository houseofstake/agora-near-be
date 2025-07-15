import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const traceExporter = new OTLPTraceExporter({
  url: 'https://api.datadoghq.com/api/v2/otlp/v1/traces',
  headers: {
    'DD-API-KEY': process.env.DD_API_KEY || '',
  }
});

const metricExporter = new OTLPMetricExporter({
  url: 'https://api.datadoghq.com/api/v2/otlp/v1/metrics',
  headers: {
    'DD-API-KEY': process.env.DD_API_KEY || '',
  }
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60000,
});

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'agora-near-be',
});

const sdk = new NodeSDK({
  traceExporter,
  metricReader,
  instrumentations: getNodeAutoInstrumentations(),
  resource,
});

sdk.start()