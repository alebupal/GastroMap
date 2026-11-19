import pkg from "../../package.json";

/**
 * Fuente única de verdad para la versión de la aplicación.
 * Lee directamente de package.json tanto en servidor como en cliente.
 */
export const APP_VERSION: string = pkg.version || "0.1.0";
