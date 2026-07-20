// === nginx 配置词法分析器 ===
// 将原始配置文本转为 Token 流

export enum TokenType {
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  SEMICOLON = 'SEMICOLON',
  WORD = 'WORD',
  STRING = 'STRING',
  VARIABLE = 'VARIABLE',
  REGEX = 'REGEX',
  NUMBER = 'NUMBER',
  COMMENT = 'COMMENT',
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private input: string;
  private pos: number;
  private line: number;
  private col: number;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    let token: Token;
    while ((token = this.nextToken()).type !== TokenType.EOF) {
      if (token.type !== TokenType.COMMENT) {
        tokens.push(token);
      }
    }
    tokens.push(token);
    return tokens;
  }

  private nextToken(): Token {
    this.skipWhitespace();

    if (this.pos >= this.input.length) {
      return this.makeToken(TokenType.EOF, '');
    }

    const ch = this.input[this.pos];

    // 注释 #
    if (ch === '#') {
      return this.readComment();
    }

    // 结构符号
    if (ch === '{') return this.makeToken(TokenType.LBRACE, '{', 1);
    if (ch === '}') return this.makeToken(TokenType.RBRACE, '}', 1);
    if (ch === ';') return this.makeToken(TokenType.SEMICOLON, ';', 1);

    // 变量 $var_name
    if (ch === '$') {
      return this.readVariable();
    }

    // 正则 ~ 或 ~*
    if (ch === '~') {
      return this.readRegex();
    }

    // 字符串 "..." 或 '...'
    if (ch === '"' || ch === "'") {
      return this.readString(ch);
    }

    // 数字或普通单词
    return this.readWordOrNumber();
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else if (ch === '\n') {
        this.line++;
        this.col = 1;
        this.pos++;
      } else {
        break;
      }
    }
  }

  private readComment(): Token {
    const startCol = this.col;
    const line = this.line;
    this.advance(); // skip #
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
      value += this.input[this.pos];
      this.advance();
    }
    return { type: TokenType.COMMENT, value: `#${value}`, line, column: startCol };
  }

  private readVariable(): Token {
    const startCol = this.col;
    const line = this.line;
    this.advance(); // skip $
    let value = '$';
    while (this.pos < this.input.length && /[a-zA-Z0-9_]/.test(this.input[this.pos])) {
      value += this.input[this.pos];
      this.advance();
    }
    return { type: TokenType.VARIABLE, value, line, column: startCol };
  }

  private readRegex(): Token {
    const startCol = this.col;
    const line = this.line;
    let value = '';
    // 读取 ~ 或 ~* 操作符本身
    value += this.input[this.pos];
    this.advance();
    if (this.pos < this.input.length && this.input[this.pos] === '*') {
      value += '*';
      this.advance();
    }

    // 跳过空格
    while (this.pos < this.input.length && this.input[this.pos] === ' ') {
      this.advance();
    }

    // 读取正则内容直到 ; 或 { 或换行
    while (
      this.pos < this.input.length &&
      this.input[this.pos] !== ';' &&
      this.input[this.pos] !== '{' &&
      this.input[this.pos] !== '\n'
    ) {
      value += this.input[this.pos];
      this.advance();
    }
    return { type: TokenType.REGEX, value: value.trim(), line, column: startCol };
  }

  private readString(quote: string): Token {
    const startCol = this.col;
    const line = this.line;
    this.advance(); // skip opening quote
    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\') {
        this.advance();
      }
      value += this.input[this.pos];
      this.advance();
    }
    if (this.pos < this.input.length) {
      this.advance(); // skip closing quote
    }
    return { type: TokenType.STRING, value, line, column: startCol };
  }

  private readWordOrNumber(): Token {
    const startCol = this.col;
    const line = this.line;
    let value = '';
    while (
      this.pos < this.input.length &&
      !/[\s{};#'"]/.test(this.input[this.pos])
    ) {
      value += this.input[this.pos];
      this.advance();
    }

    if (/^\d+(\.\d+)?[kKmMgG]?$/.test(value)) {
      return { type: TokenType.NUMBER, value, line, column: startCol };
    }
    return { type: TokenType.WORD, value, line, column: startCol };
  }

  private advance(): void {
    this.col++;
    this.pos++;
  }

  private makeToken(type: TokenType, value: string, skip: number = 0): Token {
    const token: Token = { type, value, line: this.line, column: this.col };
    this.pos += skip;
    this.col += skip;
    return token;
  }
}
