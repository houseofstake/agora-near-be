// src/tracer.ts
import tracer from 'dd-trace'
import { PrismaInstrumentation, registerInstrumentations } from '@prisma/instrumentation'

// Initialize the tracer **before** anything else
const traceAgent = tracer.init({
  service: process.env.DD_SERVICE,
  env: process.env.DD_ENV,
  version: process.env.DD_VERSION,
  logInjection: true,
  profiling: true,
  runtimeMetrics: true,
  hostname: process.env.DD_TRACE_AGENT_HOSTNAME,
  port: Number(process.env.DD_TRACE_AGENT_PORT),
});

const provider = new traceAgent.TracerProvider();
provider.register();

// Hook Prisma
registerInstrumentations({
  tracerProvider: provider,
  instrumentations: [
    new PrismaInstrumentation({
      // you can tweak options here if needed
      enabled: true
    }),
  ],
})

// Export if you need it elsewhere
export default provider
