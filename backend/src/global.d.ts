/**
 * Global type declarations for modules without TypeScript definitions
 * and Node.js built-in APIs used across the project.
 */

// Node 18+ global fetch
declare const fetch: typeof globalThis.fetch;

// ============================================
// @sentry/node
// ============================================
declare module "@sentry/node" {
  export function init(options: any): void;
  export function captureException(error: any, context?: any): void;
  export function captureMessage(message: string, level?: any): void;
  export function setUser(user: any): void;
  export function setTag(key: string, value: string): void;
  export function setContext(name: string, context: any): void;
  export function startSpan(options: any, callback: (span: any) => any): any;
  export function withScope(callback: (scope: any) => void): void;
  export function addBreadcrumb(breadcrumb: any): void;
  export function setupExpressErrorHandler(app: any): void;
  export const Handlers: {
    requestHandler(): any;
    errorHandler(): any;
    tracingHandler(): any;
  };
  export const Integrations: {
    Http: new (options?: any) => any;
    Express: new (options?: any) => any;
    Postgres: new (options?: any) => any;
    [key: string]: new (options?: any) => any;
  };
}

// ============================================
// ethers
// ============================================
declare module "ethers" {
  export class Contract {
    constructor(address: string, abi: any[], providerOrSigner: any);
    [key: string]: any;
  }
  export class JsonRpcProvider {
    constructor(url?: string);
    [key: string]: any;
  }
  export class Wallet {
    constructor(privateKey: string, provider?: any);
    [key: string]: any;
  }
  export class Signer {
    [key: string]: any;
  }
  export class Provider {
    [key: string]: any;
  }
  export function getAddress(address: string): string;
  export function isAddress(address: string): boolean;
  export function id(text: string): string;
  export const ethers: {
    Contract: typeof Contract;
    JsonRpcProvider: typeof JsonRpcProvider;
    Wallet: typeof Wallet;
    Signer: typeof Signer;
    Provider: typeof Provider;
    getAddress: typeof getAddress;
    isAddress: typeof isAddress;
    id: typeof id;
    [key: string]: any;
  };
}

// ============================================
// @opentelemetry/*
// ============================================
declare module "@opentelemetry/resources" {
  export class Resource {
    static default(): Resource;
    merge(other: Resource): Resource;
    constructor(attributes: Record<string, string>);
  }
}

declare module "@opentelemetry/semantic-conventions" {
  export const ATTR_SERVICE_NAME: string;
  export const ATTR_SERVICE_VERSION: string;
  export const SemanticResourceAttributes: {
    SERVICE_NAME: string;
    SERVICE_VERSION: string;
  };
}

declare module "@opentelemetry/exporter-trace-otlp-http" {
  export class OTLPTraceExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> });
  }
}

declare module "@opentelemetry/sdk-node" {
  export class NodeSDK {
    constructor(options?: any);
    start(): void;
    shutdown(): Promise<void>;
  }
}

declare module "@opentelemetry/auto-instrumentations-node" {
  export function getNodeAutoInstrumentations(config?: any): any[];
}

// ============================================
// @google-cloud/secret-manager
// ============================================
declare module "@google-cloud/secret-manager" {
  export class SecretManagerServiceClient {
    constructor(options?: any);
    accessSecretVersion(request: any): Promise<[any, any, any]>;
    listSecrets(request: any): Promise<[any[], any, any]>;
    secretVersionPath(project: string, secret: string, version: string): string;
    [key: string]: any;
  }
}
