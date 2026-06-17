declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface Statement {
    bind(params?: any[] | Record<string, any>): boolean;
    step(): boolean;
    getAsObject(): Record<string, any>;
    get(params?: any[]): any[];
    getColumnNames(): string[];
    run(params?: any[]): void;
    reset(): void;
    free(): boolean;
  }

  export class Database {
    constructor(data?: Uint8Array | Buffer | number[] | null);
    exec(sql: string): Array<{ columns: string[]; values: any[][] }>;
    run(sql: string, params?: any[] | Record<string, any>): Database;
    prepare(sql: string, params?: any[] | Record<string, any>): Statement;
    each(sql: string, params: any[] | Record<string, any>, callback: (row: Record<string, any>) => void, done: () => void): Database;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
