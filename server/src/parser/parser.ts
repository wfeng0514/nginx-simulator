// === nginx 配置递归下降解析器 ===
// 将 Token 流解析为 AST

import { Lexer, Token, TokenType } from './lexer';
import {
  ParsedConfig,
  HttpBlock,
  ServerBlock,
  LocationBlock,
  UpstreamBlock,
  UpstreamServerDef,
  EventsBlock,
  Directive,
} from './types';

export class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse(filePath: string): ParsedConfig {
    const isDev = filePath.toLowerCase().includes('dev');
    const config: ParsedConfig = {
      filePath,
      environment: isDev ? 'dev' : 'prod',
    };

    while (!this.isEOF()) {
      if (this.peek()?.type === TokenType.WORD) {
        const word = this.peek()!.value;
        if (word === 'events') {
          config.events = this.parseEvents();
        } else if (word === 'http') {
          config.http = this.parseHttp();
        } else {
          // 跳过顶层未知指令
          this.skipBlock();
        }
      } else {
        this.advance();
      }
    }

    return config;
  }

  private parseEvents(): EventsBlock {
    this.expectWord('events');
    this.expect(TokenType.LBRACE);
    const directives: Directive[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isEOF()) {
      const dir = this.parseDirective();
      if (dir) directives.push(dir);
    }
    this.expect(TokenType.RBRACE);

    return { directives };
  }

  private parseHttp(): HttpBlock {
    this.expectWord('http');
    this.expect(TokenType.LBRACE);

    const directives: Directive[] = [];
    const upstreams: UpstreamBlock[] = [];
    const servers: ServerBlock[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isEOF()) {
      if (this.peek()?.type === TokenType.WORD) {
        const word = this.peek()!.value;
        if (word === 'upstream') {
          upstreams.push(this.parseUpstream());
        } else if (word === 'server') {
          servers.push(this.parseServer());
        } else {
          const dir = this.parseDirective();
          if (dir) directives.push(dir);
        }
      } else {
        this.advance();
      }
    }
    this.expect(TokenType.RBRACE);

    return { directives, upstreams, servers };
  }

  private parseUpstream(): UpstreamBlock {
    this.expectWord('upstream');
    const name = this.expect(TokenType.WORD).value;
    this.expect(TokenType.LBRACE);

    const directives: Directive[] = [];
    const servers: UpstreamServerDef[] = [];
    let algorithm = 'round_robin';

    while (!this.check(TokenType.RBRACE) && !this.isEOF()) {
      if (this.peek()?.type === TokenType.WORD) {
        const word = this.peek()!.value;
        if (word === 'server') {
          servers.push(this.parseUpstreamServer());
        } else if (word === 'least_conn') {
          algorithm = 'least_conn';
          directives.push(this.parseDirective()!);
        } else if (word === 'ip_hash') {
          algorithm = 'ip_hash';
          directives.push(this.parseDirective()!);
        } else if (word === 'random') {
          algorithm = 'random';
          directives.push(this.parseDirective()!);
        } else {
          const dir = this.parseDirective();
          if (dir) directives.push(dir);
        }
      } else {
        this.advance();
      }
    }
    this.expect(TokenType.RBRACE);

    return { name, algorithm, directives, servers };
  }

  private parseUpstreamServer(): UpstreamServerDef {
    this.expectWord('server');
    const addrToken = this.expect(TokenType.WORD);
    const [address, portStr] = addrToken.value.split(':');
    const port = portStr ? parseInt(portStr, 10) : 80;

    const server: UpstreamServerDef = {
      address,
      port,
      weight: 1,
      maxFails: 1,
      failTimeout: 10,
      backup: false,
      down: false,
    };

    // 解析服务器参数
    while (!this.check(TokenType.SEMICOLON) && !this.isEOF()) {
      const key = this.peek()?.value;
      if (key === 'weight') {
        this.advance();
        server.weight = parseInt(this.expect(TokenType.NUMBER).value, 10);
      } else if (key === 'max_fails') {
        this.advance();
        server.maxFails = parseInt(this.expect(TokenType.NUMBER).value, 10);
      } else if (key === 'fail_timeout') {
        this.advance();
        server.failTimeout = this.parseTime(this.expect(TokenType.NUMBER).value);
      } else if (key === 'backup') {
        this.advance();
        server.backup = true;
      } else if (key === 'down') {
        this.advance();
        server.down = true;
      } else if (key === '=') {
        // 跳过等号
        this.advance();
      } else {
        this.advance();
      }
    }
    this.expect(TokenType.SEMICOLON);
    return server;
  }

  private parseServer(): ServerBlock {
    this.expectWord('server');
    this.expect(TokenType.LBRACE);

    const server: ServerBlock = {
      listen: [],
      serverName: [],
      directives: [],
      locations: [],
    };

    while (!this.check(TokenType.RBRACE) && !this.isEOF()) {
      if (this.peek()?.type === TokenType.WORD) {
        const word = this.peek()!.value;
        if (word === 'location') {
          server.locations.push(this.parseLocation());
        } else {
          const dir = this.parseDirective();
          if (dir) {
            if (dir.name === 'listen') {
              server.listen.push(dir);
            } else if (dir.name === 'server_name') {
              server.serverName.push(dir);
            } else {
              server.directives.push(dir);
            }
          }
        }
      } else {
        this.advance();
      }
    }
    this.expect(TokenType.RBRACE);

    return server;
  }

  private parseLocation(): LocationBlock {
    this.expectWord('location');

    let modifier: LocationBlock['modifier'] = null;
    let prefix = '';

    // 检查修饰符
    if (this.peek()?.value === '=') {
      modifier = '=';
      this.advance();
    } else if (this.peek()?.value === '^~') {
      modifier = '^~';
      this.advance();
    } else if (this.peek()?.type === TokenType.REGEX) {
      const val = this.peek()!.value;
      if (val.startsWith('~*')) {
        modifier = '~*';
        prefix = val.slice(2).trim();
      } else {
        modifier = '~';
        prefix = val.slice(1).trim();
      }
      this.advance();
    } else if (this.peek()?.value === '~' || this.peek()?.value === '~*') {
      // 在某些格式中，操作符和模式是分开的
      if (this.peek()!.value === '~*') modifier = '~*';
      else modifier = '~';
      this.advance();
    }

    // 如果不是正则操作符，读取路径前缀
    if (!modifier || (modifier !== '~' && modifier !== '~*' && !prefix)) {
      if (this.peek()?.type === TokenType.WORD || this.peek()?.type === TokenType.STRING) {
        prefix = this.peek()!.value;
        this.advance();
      }
    }

    this.expect(TokenType.LBRACE);

    const directives: Directive[] = [];
    const nested: LocationBlock[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isEOF()) {
      if (this.peek()?.value === 'location') {
        nested.push(this.parseLocation());
      } else {
        const dir = this.parseDirective();
        if (dir) directives.push(dir);
      }
    }
    this.expect(TokenType.RBRACE);

    return { modifier, prefix, directives, nested };
  }

  private parseDirective(): Directive | null {
    if (this.peek()?.type !== TokenType.WORD) {
      return null;
    }

    const name = this.peek()!.value;
    const line = this.peek()!.line;
    this.advance();

    const parameters: string[] = [];

    while (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.LBRACE) && !this.isEOF()) {
      const tok = this.peek()!;
      if (tok.type === TokenType.WORD || tok.type === TokenType.STRING ||
          tok.type === TokenType.VARIABLE || tok.type === TokenType.NUMBER ||
          tok.type === TokenType.REGEX) {
        parameters.push(tok.value);
      }
      this.advance();
    }

    if (this.check(TokenType.LBRACE)) {
      // 块指令（如 map, types, limit_except 等）——跳过块内容
      this.skipBlock();
      return { name, parameters, line };
    }

    this.expect(TokenType.SEMICOLON);
    return { name, parameters, line };
  }

  private skipBlock(): void {
    let depth = 0;
    while (!this.isEOF()) {
      if (this.check(TokenType.LBRACE)) {
        depth++;
        this.advance();
      } else if (this.check(TokenType.RBRACE)) {
        if (depth === 0) return;
        depth--;
        this.advance();
      } else {
        this.advance();
      }
    }
  }

  private parseTime(value: string): number {
    const num = parseInt(value, 10);
    if (value.endsWith('s')) return num;
    if (value.endsWith('m')) return num * 60;
    if (value.endsWith('h')) return num * 3600;
    if (value.endsWith('d')) return num * 86400;
    return num;
  }

  // === 辅助方法 ===

  private peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  private check(type: TokenType): boolean {
    return this.peek()?.type === type;
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    if (this.pos < this.tokens.length) this.pos++;
    return token || { type: TokenType.EOF, value: '', line: 0, column: 0 };
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (!token || token.type !== type) {
      throw new Error(
        `Parse error at line ${token?.line ?? '?'}: expected ${type} but got ${token?.type ?? 'EOF'} (${token?.value ?? ''})`
      );
    }
    return this.advance();
  }

  private expectWord(value: string): void {
    const token = this.expect(TokenType.WORD);
    if (token.value !== value) {
      throw new Error(
        `Parse error at line ${token.line}: expected "${value}" but got "${token.value}"`
      );
    }
  }

  private isEOF(): boolean {
    return this.pos >= this.tokens.length || this.tokens[this.pos].type === TokenType.EOF;
  }
}

/** 便捷方法：解析配置文本 */
export function parseConfig(text: string, filePath: string): ParsedConfig {
  const lexer = new Lexer(text);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse(filePath);
}
