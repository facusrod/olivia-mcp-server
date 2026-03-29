import axios from 'axios';
import { Readable } from 'stream';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Serializer = require('xmlrpc/lib/serializer');
const Deserializer = require('xmlrpc/lib/deserializer');

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
}

export type ExecuteKw = (
  model: string,
  method: string,
  args?: any[],
  kwargs?: any,
) => Promise<any>;

/**
 * Traduce errores de red/HTTP a mensajes amigables para el usuario.
 * Evita que Claude sugiera acciones técnicas como "docker restart".
 */
function friendlyError(error: any): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
      return 'El servicio de Odoo no está disponible en este momento. Por favor intentá de nuevo más tarde.';
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'La conexión con Odoo tardó demasiado y se agotó el tiempo de espera. Por favor intentá de nuevo en unos minutos.';
    }
    if (error.code === 'ECONNRESET') {
      return 'Se perdió la conexión con Odoo. Por favor intentá de nuevo.';
    }
    if (error.response) {
      const status = error.response.status;
      if (status === 403) {
        return 'Acceso denegado al servidor de Odoo. Verificá las credenciales de Cloudflare Access o los permisos de la cuenta.';
      }
      if (status === 404) {
        return 'No se encontró el endpoint de Odoo. Verificá que la URL configurada sea correcta.';
      }
      if (status === 500 || status === 502 || status === 503 || status === 504) {
        return 'El servidor de Odoo está experimentando problemas. Por favor intentá de nuevo más tarde.';
      }
    }
  }
  return error?.message || String(error);
}

/**
 * Cliente base XML-RPC para Odoo.
 * Maneja autenticación, conexión y expone executeKw para los servicios de dominio.
 */
export class OdooBase {
  private config: OdooConfig;
  private uid: number | null = null;
  private authPromise: Promise<number> | null = null;
  private cfHeaders: Record<string, string> = {};

  constructor() {
    this.config = {
      url: process.env.ODOO_URL || '',
      db: process.env.ODOO_DB || '',
      username: process.env.ODOO_USERNAME || '',
      password: process.env.ODOO_PASSWORD || '',
    };

    if (!this.config.url || !this.config.db || !this.config.username || !this.config.password) {
      throw new Error(
        'Missing required env vars: ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD. ' +
        'Set them in claude_desktop_config.json → mcpServers → env.'
      );
    }

    const cfClientId = process.env.CF_ACCESS_CLIENT_ID;
    const cfClientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
    if (cfClientId && cfClientSecret) {
      this.cfHeaders = {
        'CF-Access-Client-Id': cfClientId,
        'CF-Access-Client-Secret': cfClientSecret,
      };
    }
  }

  private async callXmlRpc(path: string, method: string, params: any[]): Promise<any> {
    const xml = Serializer.serializeMethodCall(method, params);
    const url = `${this.config.url}/xmlrpc/2/${path}`;

    let response;
    try {
      response = await axios.post(url, xml, {
        headers: {
          'Content-Type': 'text/xml',
          ...this.cfHeaders,
        },
        responseType: 'text',
        timeout: 60000,
      });
    } catch (error: any) {
      throw new Error(friendlyError(error));
    }

    return new Promise((resolve, reject) => {
      const deserializer = new Deserializer();
      const stream = Readable.from([response.data]);
      deserializer.deserializeMethodResponse(stream, (error: any, result: any) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  private async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    if (!this.authPromise) {
      this.authPromise = this.doAuthenticate();
    }
    return this.authPromise;
  }

  private async doAuthenticate(): Promise<number> {
    try {
      const uid = await this.callXmlRpc('common', 'authenticate', [
        this.config.db,
        this.config.username,
        this.config.password,
        {},
      ]);

      if (!uid) {
        throw new Error('Credenciales inválidas');
      }

      this.uid = uid;
      return uid;
    } catch (error: any) {
      this.authPromise = null;
      const msg = error?.message || String(error);
      // Si ya es un mensaje amigable (de friendlyError), no lo wrapeamos
      if (msg.startsWith('El servicio') || msg.startsWith('La conexión') || msg.startsWith('Se perdió') || msg.startsWith('Acceso denegado') || msg.startsWith('El servidor')) {
        throw error;
      }
      throw new Error(`Autenticación con Odoo falló: ${msg}`);
    }
  }

  /**
   * Ejecuta un método en un modelo de Odoo via XML-RPC.
   * Los servicios de dominio usan esta función para todas sus operaciones.
   */
  readonly executeKw: ExecuteKw = async (
    model: string,
    method: string,
    args: any[] = [],
    kwargs: any = {}
  ): Promise<any> => {
    const uid = await this.authenticate();

    try {
      return await this.callXmlRpc('object', 'execute_kw', [
        this.config.db,
        uid,
        this.config.password,
        model,
        method,
        args,
        kwargs,
      ]);
    } catch (error: any) {
      const msg = error?.message || String(error);
      if (msg.startsWith('El servicio') || msg.startsWith('La conexión') || msg.startsWith('Se perdió') || msg.startsWith('Acceso denegado') || msg.startsWith('El servidor')) {
        throw error;
      }
      throw new Error(`Error en operación Odoo (${model}.${method}): ${msg}`);
    }
  };
}
